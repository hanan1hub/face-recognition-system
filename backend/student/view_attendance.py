from flask import Blueprint, request, jsonify, current_app
from datetime import datetime
import time

attendance_bp = Blueprint("attendance", __name__)

# ------------------------- GET ATTENDANCE -------------------------
@attendance_bp.route('/api/attendance', methods=['GET'])
def get_attendance():
    """Get attendance records with proper roster merging - FIXED VERSION"""
    db = current_app.config.get("DB")
    attendance_col = db.attendance_records
    students_col = db.students

    date = request.args.get('date')
    department = request.args.get('department')
    year = request.args.get('year')
    division = request.args.get('division')
    subject = request.args.get('subject')
    student_id = request.args.get('student_id')

    try:
        # Query attendance collection
        query = {}
        if date: query["date"] = date
        if department: query["department"] = department
        if year: query["year"] = year
        if division: query["division"] = division
        if subject: query["subject"] = subject

        attendance_doc = attendance_col.find_one(query)

        # Build roster from students collection for given class filters
        roster_filter = {}
        if department: roster_filter["department"] = department
        if year: roster_filter["year"] = year
        if division: roster_filter["division"] = division

        roster = list(students_col.find(roster_filter)) if roster_filter else []

        # Map session students by id for quick lookup
        session_map = {}
        if attendance_doc:
            for s in attendance_doc.get("students", []):
                sid = s.get("student_id")
                if sid:
                    session_map[sid] = s

        attendance_list = []
        seen_students = set()

        # Merge roster and session students: show present and absent
        for student in roster:
            sid = student.get("studentId") or student.get("student_id")
            if not sid or sid in seen_students:
                continue
            seen_students.add(sid)
            
            # Apply student_id filter if provided
            if student_id and sid != student_id:
                continue

            # Check if student was marked in session
            sess = session_map.get(sid, None)
            if sess:
                present = bool(sess.get("present"))
                marked_at = sess.get("marked_at")
                # Ensure marked_at is JSON-serializable (string)
                if marked_at is not None:
                    try:
                        # If it's a datetime from Mongo, convert to ISO
                        marked_at = marked_at.isoformat()
                    except Exception:
                        # Fallback to str()
                        marked_at = str(marked_at)
            else:
                # Student not in session = absent
                present = False
                marked_at = None

            # ✅ FIXED: This is now OUTSIDE the if/else block
            # So BOTH present AND absent students get added
            attendance_list.append({
                "studentId": sid,
                "studentName": student.get("studentName") or student.get("student_name") or "Unknown",
                "date": attendance_doc.get("date") if attendance_doc else date,
                "subject": attendance_doc.get("subject") if attendance_doc else subject,
                "department": attendance_doc.get("department") if attendance_doc else department,
                "year": attendance_doc.get("year") if attendance_doc else year,
                "division": attendance_doc.get("division") if attendance_doc else division,
                "status": "present" if present else "absent",
                "markedAt": marked_at
            })

        # Also include any session-only students not in roster (edge case)
        if attendance_doc:
            for s in attendance_doc.get("students", []):
                sid = s.get("student_id")
                if not sid or sid in seen_students:
                    continue
                if student_id and sid != student_id:
                    continue
                    
                seen_students.add(sid)
                
                # Convert any datetime in s.get('marked_at') to string
                marked = s.get("marked_at")
                if marked is not None:
                    try:
                        marked = marked.isoformat()
                    except Exception:
                        marked = str(marked)

                attendance_list.append({
                    "studentId": sid,
                    "studentName": s.get("student_name") or "Unknown",
                    "date": attendance_doc.get("date"),
                    "subject": attendance_doc.get("subject"),
                    "department": attendance_doc.get("department"),
                    "year": attendance_doc.get("year"),
                    "division": attendance_doc.get("division"),
                    "status": "present" if s.get("present") else "absent",
                    "markedAt": marked
                })

        # Stats computed - FIXED to count actual attendance list
        # Use the actual attendance_list length instead of roster_filter count
        total_students = len(attendance_list)
        present_count = sum(1 for r in attendance_list if r.get("status") == "present")
        absent_count = total_students - present_count
        attendance_rate = round((present_count / total_students * 100) if total_students > 0 else 0, 1)

        return jsonify({
            "success": True,
            "attendance": attendance_list,
            "stats": {
                "totalStudents": total_students,
                "presentToday": present_count,
                "absentToday": absent_count,
                "attendanceRate": attendance_rate
            }
        })

    except Exception as e:
        current_app.logger.error(f"Error getting attendance: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


# ------------------------- EXPORT TO EXCEL -------------------------
@attendance_bp.route('/api/attendance/export', methods=['GET'])
def export_attendance():
    """Export attendance data - FIXED VERSION"""
    db = current_app.config.get("DB")
    attendance_col = db.attendance_records
    students_col = db.students

    date = request.args.get('date')
    department = request.args.get('department')
    year = request.args.get('year')
    division = request.args.get('division')
    subject = request.args.get('subject')

    try:
        # Get attendance doc
        query = {}
        if date: query["date"] = date
        if department: query["department"] = department
        if year: query["year"] = year
        if division: query["division"] = division
        if subject: query["subject"] = subject

        attendance_doc = attendance_col.find_one(query)
        present_students = set()
        student_marked_times = {}

        # ✅ FIXED: Only add to present_students if actually present
        if attendance_doc:
            for student in attendance_doc.get("students", []):
                sid = student.get("student_id")
                if sid and student.get("present") == True:  # ← Check if present is True
                    present_students.add(sid)
                    marked_at = student.get("marked_at")
                    if marked_at:
                        try:
                            student_marked_times[sid] = marked_at.isoformat()
                        except:
                            student_marked_times[sid] = str(marked_at)

        # Get all students in that class
        student_filter = {}
        if department: student_filter["department"] = department
        if year: student_filter["year"] = year
        if division: student_filter["division"] = division

        students = list(students_col.find(student_filter))
        export_data = []

        for student in students:
            sid = student.get("studentId") or student.get("student_id")
            name = student.get("studentName") or student.get("student_name")
            status = "present" if sid in present_students else "absent"
            marked_time = student_marked_times.get(sid, "")
            
            export_data.append({
                "studentId": sid or "",
                "name": name or "Unknown",
                "department": department or "N/A",
                "year": year or "N/A",
                "division": division or "N/A",
                "subject": subject or "N/A",
                "date": date or "N/A",
                "status": status,
                "markedAt": marked_time
            })

        # Sort by status (present first) then by name
        export_data.sort(key=lambda x: (x["status"] != "present", x["name"]))

        return jsonify({
            "success": True, 
            "data": export_data,
            "summary": {
                "total": len(export_data),
                "present": len(present_students),
                "absent": len(export_data) - len(present_students)
            }
        })

    except Exception as e:
        current_app.logger.error(f"Error exporting attendance: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


# ------------------------- GET STUDENT ATTENDANCE HISTORY -------------------------
@attendance_bp.route('/api/attendance/student/<student_id>', methods=['GET'])
def get_student_attendance_history(student_id):
    """Get attendance history for a specific student"""
    db = current_app.config.get("DB")
    attendance_col = db.attendance_records
    students_col = db.students

    try:
        # Get student info
        student = students_col.find_one({
            "$or": [
                {"studentId": student_id},
                {"student_id": student_id}
            ]
        })

        if not student:
            return jsonify({"success": False, "error": "Student not found"}), 404

        # Get all attendance sessions where this student appears
        sessions = list(attendance_col.find({
            "students.student_id": student_id
        }).sort("date", -1))

        history = []
        for session in sessions:
            # Find this student's record in the session
            student_record = next(
                (s for s in session.get("students", []) if s.get("student_id") == student_id),
                None
            )

            if student_record:
                marked_at = student_record.get("marked_at")
                if marked_at:
                    try:
                        marked_at = marked_at.isoformat()
                    except:
                        marked_at = str(marked_at)

                history.append({
                    "date": session.get("date"),
                    "subject": session.get("subject"),
                    "department": session.get("department"),
                    "year": session.get("year"),
                    "division": session.get("division"),
                    "status": "present" if student_record.get("present") else "absent",
                    "markedAt": marked_at
                })

        # Calculate statistics
        total_sessions = len(history)
        present_count = sum(1 for h in history if h["status"] == "present")
        absent_count = total_sessions - present_count
        attendance_rate = round((present_count / total_sessions * 100) if total_sessions > 0 else 0, 1)

        return jsonify({
            "success": True,
            "student": {
                "studentId": student.get("studentId") or student.get("student_id"),
                "studentName": student.get("studentName") or student.get("student_name"),
                "department": student.get("department"),
                "year": student.get("year"),
                "division": student.get("division")
            },
            "history": history,
            "statistics": {
                "totalSessions": total_sessions,
                "present": present_count,
                "absent": absent_count,
                "attendanceRate": attendance_rate
            }
        })

    except Exception as e:
        current_app.logger.error(f"Error getting student history: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500