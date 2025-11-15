"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AttendanceRecord {
  _id: string;
  studentId: string;
  studentName: string;
  date: string;
  time: string;
  status: "present" | "absent";
  department?: string;
  year?: string;
  subject?: string;
}

export default function ViewAttendance() {
  const router = useRouter();
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterStudentId, setFilterStudentId] = useState("");
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    absentToday: 0,
    attendanceRate: 0,
  });
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAttendanceData = async () => {
    // Validate filters
    if (!selectedDate && !filterDepartment) {
      setError("Please select at least a date or department filter.");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.set("date", selectedDate);
      if (filterDepartment) params.set("department", filterDepartment);
      if (filterYear) params.set("year", filterYear);
      if (filterSubject) params.set("subject", filterSubject);
      if (filterStudentId) params.set("student_id", filterStudentId);

      const res = await fetch(`http://127.0.0.1:5000/api/attendance?${params.toString()}`);
      
      if (!res.ok) {
        throw new Error(`Server error: ${res.status} ${res.statusText}`);
      }

      const raw = await res.text();
      let data: any;
      
      try {
        data = JSON.parse(raw);
      } catch (err) {
        console.error("Failed to parse response. Status:", res.status, "Body:", raw);
        throw new Error("Invalid response from server");
      }

      if (data && data.success) {
        const mappedData: AttendanceRecord[] = data.attendance.map((record: any, idx: number) => {
          // Format date properly
          let formattedDate = selectedDate;
          if (record.date) {
            try {
              const dateObj = new Date(record.date);
              formattedDate = dateObj.toISOString().split('T')[0];
            } catch {
              formattedDate = record.date;
            }
          }

          // Format time properly
          let formattedTime = "-";
          if (record.markedAt) {
            try {
              const timeObj = new Date(record.markedAt);
              formattedTime = timeObj.toLocaleTimeString();
            } catch {
              formattedTime = record.markedAt;
            }
          }

          return {
            _id: record.studentId || `row-${idx}`,
            studentId: record.studentId || record.student_id || "-",
            studentName: record.studentName || record.student_name || "Unknown",
            date: formattedDate,
            time: formattedTime,
            status: record.status === "present" ? "present" : "absent", // ✅ Fixed: explicit check
            department: record.department,
            year: record.year,
            division: record.division,
            subject: record.subject,
          };
        });
        
        setAttendanceData(mappedData);
        setStats(data.stats || {
          totalStudents: 0,
          presentToday: 0,
          absentToday: 0,
          attendanceRate: 0,
        });
        setSearched(true);
      } else {
        throw new Error(data?.error || "Failed to fetch attendance data");
      }
    } catch (error: any) {
      console.error("Error fetching attendance:", error);
      setError(error.message || "Failed to fetch attendance data");
      setAttendanceData([]);
      setStats({
        totalStudents: 0,
        presentToday: 0,
        absentToday: 0,
        attendanceRate: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = async () => {
    // Check if search was done
    if (!searched || attendanceData.length === 0) {
      setError("Please search for attendance records before exporting");
      return;
    }

    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.set("date", selectedDate);
      if (filterDepartment) params.set("department", filterDepartment);
      if (filterYear) params.set("year", filterYear);
      if (filterSubject) params.set("subject", filterSubject);

      const res = await fetch(`http://127.0.0.1:5000/api/attendance/export?${params.toString()}`);
      
      if (!res.ok) {
        throw new Error(`Export failed: ${res.status} ${res.statusText}`);
      }

      const raw = await res.text();
      let data: any;
      
      try {
        data = JSON.parse(raw);
      } catch (err) {
        console.error("Failed to parse export response. Status:", res.status, "Body:", raw);
        throw new Error("Invalid export response from server");
      }

      if (data && data.success) {
        // Dynamic import to avoid SSR issues
        const XLSX = await import("xlsx");
        const worksheet = XLSX.utils.json_to_sheet(data.data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
        
        const filename = `attendance_${selectedDate || "export"}_${Date.now()}.xlsx`;
        XLSX.writeFile(workbook, filename);
      } else {
        throw new Error(data?.error || "Export failed");
      }
    } catch (error: any) {
      console.error("Error exporting excel:", error);
      setError(error.message || "Failed to export attendance data");
    }
  };

  const clearFilters = () => {
    setSelectedDate("");
    setFilterDepartment("");
    setFilterYear("");
    setFilterSubject("");
    setFilterStudentId("");
    setAttendanceData([]);
    setSearched(false);
    setError(null);
    setStats({
      totalStudents: 0,
      presentToday: 0,
      absentToday: 0,
      attendanceRate: 0,
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Attendance Records</h1>
            <p className="text-gray-600">View and manage student attendance data</p>
          </div>
          <button
            onClick={() => router.push("/teacher/dashboard")}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
              ✕
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Date *</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Departments</option>
                  <option value="Computer Science">Computer Science</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Mechanical">Mechanical</option>
                  <option value="Civil">Civil</option>
                  <option value="Electrical">Electrical</option>
                </select>
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Years</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
              </div>
              
            </div>
            
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  placeholder="e.g., Mathematics"
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
                <input
                  value={filterStudentId}
                  onChange={(e) => setFilterStudentId(e.target.value)}
                  placeholder="e.g., CS2021001"
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <button
                onClick={fetchAttendanceData}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                🔍 {loading ? "Searching..." : "Search"}
              </button>
              <button
                onClick={exportExcel}
                disabled={!searched || attendanceData.length === 0}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                📑 Export Excel
              </button>
              <button
                onClick={clearFilters}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        {attendanceData.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.totalStudents}</div>
              <div className="text-sm text-gray-600 mt-1">Total Students</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <div className="text-3xl font-bold text-green-600">{stats.presentToday}</div>
              <div className="text-sm text-gray-600 mt-1">Present</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <div className="text-3xl font-bold text-red-600">{stats.absentToday}</div>
              <div className="text-sm text-gray-600 mt-1">Absent</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <div className="text-3xl font-bold text-purple-600">{stats.attendanceRate}%</div>
              <div className="text-sm text-gray-600 mt-1">Attendance Rate</div>
            </div>
          </div>
        )}

        {/* Attendance Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">
              Attendance Records
              {selectedDate && ` - ${new Date(selectedDate + 'T00:00:00').toLocaleDateString()}`}
              {filterDepartment && ` - ${filterDepartment}`}
              {filterYear && ` - ${filterYear}`}
            </h3>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading attendance data...</p>
            </div>
          ) : !searched ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-4">📋</div>
              <p className="text-lg">Please select filters and click <b>Search</b> to view attendance records.</p>
              <p className="text-sm mt-2">* Date or Department is required</p>
            </div>
          ) : attendanceData.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-4">📭</div>
              <p className="text-lg">No attendance records found for the selected filters.</p>
              <p className="text-sm mt-2">Try adjusting your search criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time Marked
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attendanceData.map((record) => (
                    <tr key={record._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {record.studentId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.studentName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.time}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full ${
                            record.status === "present"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {record.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Info */}
        {attendanceData.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Showing {attendanceData.length} record{attendanceData.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </main>
  );
}