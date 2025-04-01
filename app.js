// app.js - Backend Server for Teacher Dashboard

const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Google Sheets Configuration
// Validate required environment variables
if (!process.env.SPREADSHEET_ID) {
  console.error('ERROR: SPREADSHEET_ID is required in .env file');
  process.exit(1);
}

if (!process.env.GOOGLE_CREDENTIALS) {
  console.error('ERROR: GOOGLE_CREDENTIALS is required in .env file');
  process.exit(1);
}

// Initialize Google Sheets API
let credentials;
try {
  credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
} catch (error) {
  console.error('ERROR: GOOGLE_CREDENTIALS must be a valid JSON string');
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  credentials: credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// Test Google Sheets connection on startup
async function testSheetsConnection() {
  try {
    console.log(`Connecting to Google Sheet with ID: ${SPREADSHEET_ID}`);
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });
    console.log(`Successfully connected to Google Sheet: "${response.data.properties.title}"`);
  } catch (error) {
    console.error('Failed to connect to Google Sheets:', error.message);
    console.error('Please check your SPREADSHEET_ID and GOOGLE_CREDENTIALS');
    process.exit(1);
  }
}

// Run the connection test
testSheetsConnection();

// Routes
app.get('/', (req, res) => {
  res.send('Teacher Dashboard API is running');
});

// Authentication
app.post('/api/auth', async (req, res) => {
  try {
    const { employeeId } = req.body;
    
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Employee ID is required' });
    }
    
    // Fetch authentication data from Google Sheets
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Authentication!A:B', // Sheet name and range
    });
    
    const rows = response.data.values || [];
    
    // Find the employee
    const employee = rows.find(row => row[0] === employeeId);
    
    if (!employee) {
      return res.status(401).json({ success: false, message: 'Invalid Employee ID' });
    }
    
    // For security, in a real app, you'd add JWT token generation here
    return res.status(200).json({
      success: true, 
      message: 'Authentication successful',
      token: 'sample-token-' + Date.now() // Placeholder token
    });
    
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ success: false, message: 'Server error during authentication' });
  }
});

// Teacher Data
app.get('/api/teacher-data', async (req, res) => {
  try {
    const employeeId = req.query.id;
    
    // Fetch teacher data from Google Sheets
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Teachers!A:E', // Sheet name and range
    });
    
    const rows = response.data.values || [];
    
    // Skip header row and find the teacher
    let teacherData;
    if (employeeId) {
      const teacher = rows.slice(1).find(row => row[0] === employeeId);
      if (!teacher) {
        return res.status(404).json({ success: false, message: 'Teacher not found' });
      }
      teacherData = {
        id: teacher[0],
        name: teacher[1],
        subject: teacher[2],
        class: teacher[3],
        department: teacher[4] || 'General'
      };
    } else {
      // Return first teacher if no ID provided (for demo/testing)
      const firstTeacher = rows[1];
      teacherData = {
        id: firstTeacher[0],
        name: firstTeacher[1],
        subject: firstTeacher[2],
        class: firstTeacher[3],
        department: firstTeacher[4] || 'General'
      };
    }
    
    res.status(200).json(teacherData);
    
  } catch (error) {
    console.error('Error fetching teacher data:', error);
    res.status(500).json({ success: false, message: 'Server error fetching teacher data' });
  }
});

// Dashboard Data
app.get('/api/dashboard-data', async (req, res) => {
  try {
    // Fetch class data from Google Sheets
    const enrollmentResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Students!A:E', // Sheet name and range
    });
    
    const students = enrollmentResponse.data.values || [];
    
    // Skip header row
    const studentData = students.slice(1);
    
    // Calculate dashboard statistics
    const totalStudents = studentData.length;
    const boys = studentData.filter(student => student[2] === 'Male').length;
    const girls = studentData.filter(student => student[2] === 'Female').length;
    
    // Get performance data
    const performanceResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Performance!A:C', // Sheet name and range
    });
    
    const performanceData = performanceResponse.data.values || [];
    
    // Skip header row
    const performance = performanceData.slice(1);
    
    const brightLearners = performance.filter(student => student[2] === 'Bright Learner').length;
    const lateBoomers = performance.filter(student => student[2] === 'Late Bloomer').length;
    
    // Get workshop data
    const workshopResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Workshops!A:C', // Sheet name and range
    });
    
    const workshopData = workshopResponse.data.values || [];
    
    // Skip header row
    const workshops = workshopData.slice(1);
    
    const workshopsCompleted = workshops.filter(workshop => workshop[2] === 'Completed').length;
    
    // Calculate category distributions
    const categories = [
      { category: 'General', count: studentData.filter(student => student[3] === 'General').length },
      { category: 'OBC', count: studentData.filter(student => student[3] === 'OBC').length },
      { category: 'SC', count: studentData.filter(student => student[3] === 'SC').length },
      { category: 'ST', count: studentData.filter(student => student[3] === 'ST').length },
      { category: 'Muslim', count: studentData.filter(student => student[3] === 'Muslim').length }
    ];
    
    const performanceDistribution = [
      { name: 'Excellent', count: performance.filter(student => student[1] === 'Excellent').length },
      { name: 'Good', count: performance.filter(student => student[1] === 'Good').length },
      { name: 'Average', count: performance.filter(student => student[1] === 'Average').length },
      { name: 'Needs Improvement', count: performance.filter(student => student[1] === 'Needs Improvement').length }
    ];
    
    // Send response
    res.status(200).json({
      totalStudents,
      boys,
      girls,
      brightLearners,
      lateBoomers,
      workshopsCompleted,
      pendingReports: 3, // Sample data
      categories,
      performance: performanceDistribution
    });
    
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ success: false, message: 'Server error fetching dashboard data' });
  }
});

// Enrollment Data
app.get('/api/enrollment-data', async (req, res) => {
  try {
    // Fetch enrollment data from Google Sheets
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Students!A:G', // Sheet name and range
    });
    
    const rows = response.data.values || [];
    
    // Skip header row and format data
    const students = rows.slice(1).map(row => ({
      rollNo: row[0],
      name: row[1],
      gender: row[2],
      category: row[3],
      serviceCategory: row[4],
      contact: row[5],
      status: row[6] || 'Active'
    }));
    
    res.status(200).json(students);
    
  } catch (error) {
    console.error('Error fetching enrollment data:', error);
    res.status(500).json({ success: false, message: 'Server error fetching enrollment data' });
  }
});

// Categories Data
app.get('/api/categories-data', async (req, res) => {
  try {
    // Fetch student data from Google Sheets
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Students!A:G', // Sheet name and range
    });
    
    const rows = response.data.values || [];
    
    // Skip header row
    const students = rows.slice(1);
    
    // Calculate caste categories
    const casteCategories = [
      { name: 'General', count: students.filter(student => student[3] === 'General').length },
      { name: 'OBC', count: students.filter(student => student[3] === 'OBC').length },
      { name: 'SC', count: students.filter(student => student[3] === 'SC').length },
      { name: 'ST', count: students.filter(student => student[3] === 'ST').length },
      { name: 'Muslim', count: students.filter(student => student[3] === 'Muslim').length }
    ];
    
    // Calculate service categories
    const serviceCategories = [
      { category: '1', count: students.filter(student => student[4] === '1').length },
      { category: '2', count: students.filter(student => student[4] === '2').length },
      { category: '3', count: students.filter(student => student[4] === '3').length },
      { category: '4', count: students.filter(student => student[4] === '4').length },
      { category: '5', count: students.filter(student => student[4] === '5').length }
    ];
    
    // Get performance data
    const performanceResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Performance!A:C', // Sheet name and range
    });
    
    const performanceData = performanceResponse.data.values || [];
    const performance = performanceData.slice(1);
    
    // Create detailed category data
    const detailedCategories = casteCategories.map(category => {
      const categoryStudents = students.filter(student => student[3] === category.name);
      const boys = categoryStudents.filter(student => student[2] === 'Male').length;
      const girls = categoryStudents.filter(student => student[2] === 'Female').length;
      
      // Find students in both datasets by roll number
      const brightLearners = categoryStudents.filter(student => {
        const performanceEntry = performance.find(p => p[0] === student[0]);
        return performanceEntry && performanceEntry[2] === 'Bright Learner';
      }).length;
      
      const lateBoomers = categoryStudents.filter(student => {
        const performanceEntry = performance.find(p => p[0] === student[0]);
        return performanceEntry && performanceEntry[2] === 'Late Bloomer';
      }).length;
      
      return {
        name: category.name,
        total: category.count,
        boys,
        girls,
        brightLearners,
        lateBoomers
      };
    });
    
    res.status(200).json({
      casteCategories,
      serviceCategories,
      detailedCategories
    });
    
  } catch (error) {
    console.error('Error fetching categories data:', error);
    res.status(500).json({ success: false, message: 'Server error fetching categories data' });
  }
});

// Performance Data
app.get('/api/performance-data', async (req, res) => {
  try {
    // Fetch performance data from Google Sheets
    const performanceResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Performance!A:H', // Sheet name and range including strengths and weaknesses
    });
    
    const performanceRows = performanceResponse.data.values || [];
    
    // Fetch student basic data
    const studentResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Students!A:E', // Sheet name and range
    });
    
    const studentRows = studentResponse.data.values || [];
    
    // Skip header rows
    const performance = performanceRows.slice(1);
    const students = studentRows.slice(1);
    
    // Process bright learners
    const brightLearners = performance
      .filter(row => row[2] === 'Bright Learner')
      .map(row => {
        // Find student basic info
        const student = students.find(s => s[0] === row[0]) || [];
        
        // Parse strengths and weaknesses into arrays
        const strengths = row[3] ? row[3].split(',').map(s => s.trim()) : [];
        const weaknesses = row[4] ? row[4].split(',').map(w => w.trim()) : [];
        
        return {
          id: row[0],
          name: student[1] || 'Unknown',
          rollNo: row[0],
          class: student[3] || 'Unknown',
          category: student[3] || 'Unknown',
          serviceCategory: student[4] || 'Unknown',
          strengths,
          weaknesses
        };
      });
    
    // Process late bloomers
    const lateBoomers = performance
      .filter(row => row[2] === 'Late Bloomer')
      .map(row => {
        // Find student basic info
        const student = students.find(s => s[0] === row[0]) || [];
        
        // Parse strengths and weaknesses into arrays
        const strengths = row[3] ? row[3].split(',').map(s => s.trim()) : [];
        const weaknesses = row[4] ? row[4].split(',').map(w => w.trim()) : [];
        
        return {
          id: row[0],
          name: student[1] || 'Unknown',
          rollNo: row[0],
          class: student[3] || 'Unknown',
          category: student[3] || 'Unknown',
          serviceCategory: student[4] || 'Unknown',
          strengths,
          weaknesses
        };
      });
    
    res.status(200).json({
      brightLearners,
      lateBoomers
    });
    
  } catch (error) {
    console.error('Error fetching performance data:', error);
    res.status(500).json({ success: false, message: 'Server error fetching performance data' });
  }
});

// Workshops Data
app.get('/api/workshops-data', async (req, res) => {
  try {
    // Fetch workshop data from Google Sheets
    const workshopsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Workshops!A:F', // Sheet name and range
    });
    
    // Fetch courses data from Google Sheets
    const coursesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'ServiceCourses!A:F', // Sheet name and range
    });
    
    const workshopRows = workshopsResponse.data.values || [];
    const courseRows = coursesResponse.data.values || [];
    
    // Skip header rows
    const workshopsData = workshopRows.slice(1);
    const coursesData = courseRows.slice(1);
    
    // Process workshops
    const workshops = workshopsData.map(row => {
      // Parse sessions into an array of objects
      const sessionDates = row[4] ? row[4].split(',').map(s => s.trim()) : [];
      const sessionTopics = row[5] ? row[5].split(',').map(s => s.trim()) : [];
      
      const sessions = sessionDates.map((date, index) => ({
        date,
        topic: sessionTopics[index] || 'General Discussion'
      }));
      
      return {
        id: row[0],
        title: row[1],
        duration: row[2],
        status: row[3],
        participants: row[3] === 'Scheduled' ? '0' : Math.floor(Math.random() * 30 + 15).toString(),
        sessions
      };
    });
    
    // Process service courses
    const serviceCourses = coursesData.map(row => {
      // Parse sessions into an array of objects
      const sessionDates = row[4] ? row[4].split(',').map(s => s.trim()) : [];
      const sessionTopics = row[5] ? row[5].split(',').map(s => s.trim()) : [];
      
      const sessions = sessionDates.map((date, index) => ({
        date,
        topic: sessionTopics[index] || 'General Course Content'
      }));
      
      return {
        id: row[0],
        title: row[1],
        duration: row[2],
        status: row[3],
        participants: row[3] === 'Scheduled' ? '0' : Math.floor(Math.random() * 30 + 15).toString(),
        sessions
      };
    });
    
    res.status(200).json({
      workshops,
      serviceCourses
    });
    
  } catch (error) {
    console.error('Error fetching workshops data:', error);
    res.status(500).json({ success: false, message: 'Server error fetching workshops data' });
  }
});

// Discipline Data
app.get('/api/discipline-data', async (req, res) => {
  try {
    // Fetch discipline data from Google Sheets
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Discipline!A:E', // Sheet name and range
    });
    
    const rows = response.data.values || [];
    
    // Skip header row
    const disciplineData = rows.slice(1).map(row => ({
      id: row[0],
      date: row[1],
      studentName: row[2],
      rollNo: row[3],
      description: row[4],
      actionTaken: row[5] || 'Verbal Warning'
    }));
    
    res.status(200).json(disciplineData);
    
  } catch (error) {
    console.error('Error fetching discipline data:', error);
    res.status(500).json({ success: false, message: 'Server error fetching discipline data' });
  }
});

// Achievements Data
app.get('/api/achievements-data', async (req, res) => {
  try {
    // Fetch achievement data from Google Sheets
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Achievements!A:E', // Sheet name and range
    });
    
    const rows = response.data.values || [];
    
    // Skip header row
    const achievementsData = rows.slice(1).map(row => ({
      id: row[0],
      date: row[1],
      studentName: row[2],
      title: row[3],
      description: row[4]
    }));
    
    res.status(200).json(achievementsData);
    
  } catch (error) {
    console.error('Error fetching achievements data:', error);
    res.status(500).json({ success: false, message: 'Server error fetching achievements data' });
  }
});

// Attendance Data
app.get('/api/attendance-data', async (req, res) => {
  try {
    // Fetch attendance data from Google Sheets
    const attendanceResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Attendance!A:G', // Sheet name and range
    });
    
    // Fetch students list
    const studentsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Students!A:C', // Sheet name and range - roll number, name, gender
    });
    
    const attendanceRows = attendanceResponse.data.values || [];
    const studentRows = studentsResponse.data.values || [];
    
    // Skip header rows
    const attendance = attendanceRows.slice(1);
    const students = studentRows.slice(1);
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().slice(0, 10);
    
    // Find today's attendance or generate if not exists
    const todayAttendance = attendance.filter(a => a[1] === today);
    
    const presentToday = todayAttendance.filter(a => a[3] === 'Present').length;
    const totalStudents = students.length;
    
    // Calculate weekly average (last 7 days)
    const last7Days = new Set();
    const today7 = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today7);
      d.setDate(d.getDate() - i);
      last7Days.add(d.toISOString().slice(0, 10));
    }
    
    const last7DaysAttendance = attendance.filter(a => last7Days.has(a[1]));
    const totalPresent7Days = last7DaysAttendance.filter(a => a[3] === 'Present').length;
    const totalRecords7Days = last7DaysAttendance.length;
    const weeklyAverage = Math.round((totalPresent7Days / totalRecords7Days) * 100) || 90; // Default to 90% if no data
    
    // Generate attendance trend
    const attendanceTrend = [];
    for (let i = 6; i >= 0; i--) {
      const trendDate = new Date();
      trendDate.setDate(trendDate.getDate() - i);
      const dateStr = trendDate.toISOString().slice(0, 10);
      const dateShort = `${trendDate.getMonth() + 1}/${trendDate.getDate()}`;
      
      const dayAttendance = attendance.filter(a => a[1] === dateStr);
      const presentDay = dayAttendance.filter(a => a[3] === 'Present').length;
      const totalDay = dayAttendance.length;
      
      const percentage = totalDay > 0 ? Math.round((presentDay / totalDay) * 100) : Math.round(85 + Math.random() * 10);
      
      attendanceTrend.push({
        date: dateShort,
        percentage
      });
    }
    
    // Generate class comparison
    const classComparison = [
      { class: 'X-A', percentage: weeklyAverage },
      { class: 'X-B', percentage: Math.round(85 + Math.random() * 10) },
      { class: 'X-C', percentage: Math.round(85 + Math.random() * 10) },
      { class: 'X-D', percentage: Math.round(85 + Math.random() * 10) }
    ];
    
    // Prepare student attendance data
    const studentsData = students.map(student => {
      // Get all attendance records for this student
      const studentAttendance = attendance.filter(a => a[2] === student[0]);
      const totalDays = new Set(studentAttendance.map(a => a[1])).size;
      const presentDays = studentAttendance.filter(a => a[3] === 'Present').length;
      const percentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 90;
      
      // Today's status
      const todayRecord = todayAttendance.find(a => a[2] === student[0]);
      const status = todayRecord ? todayRecord[3] : (Math.random() > 0.15 ? 'Present' : 'Absent');
      const remarks = todayRecord ? todayRecord[4] : '';
      
      return {
        rollNo: student[0],
        name: student[1],
        status,
        remarks,
        totalPresent: presentDays,
        totalDays,
        percentage
      };
    });
    
    // Count students below threshold
    const belowThreshold = studentsData.filter(s => s.percentage < 75).length;
    
    res.status(200).json({
      presentToday,
      totalStudents,
      weeklyAverage,
      belowThreshold,
      attendanceTrend,
      classComparison,
      students: studentsData
    });
    
  } catch (error) {
    console.error('Error fetching attendance data:', error);
    res.status(500).json({ success: false, message: 'Server error fetching attendance data' });
  }
});

// Assessments Data
app.get('/api/assessments-data', async (req, res) => {
  try {
    // Fetch assessments data from Google Sheets
    const assessmentsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Assessments!A:G', // Sheet name and range
    });
    
    // Fetch grades data
    const gradesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Grades!A:E', // Assessment ID, Student ID, Score, Percentage, Grade
    });
    
    const assessmentRows = assessmentsResponse.data.values || [];
    const gradeRows = gradesResponse.data.values || [];
    
    // Skip header rows
    const assessments = assessmentRows.slice(1);
    const grades = gradeRows.slice(1);
    
    // Process assessments
    const assessmentsData = assessments.map(assessment => {
      // Get grades for this assessment
      const assessmentGrades = grades.filter(g => g[0] === assessment[0]);
      
      // Calculate average if grades exist
      let average = null;
      if (assessmentGrades.length > 0) {
        const totalPercentage = assessmentGrades.reduce((sum, g) => sum + (parseFloat(g[3]) || 0), 0);
        average = Math.round(totalPercentage / assessmentGrades.length);
      }
      
      return {
        id: assessment[0],
        date: assessment[1],
        title: assessment[2],
        type: assessment[3],
        maxScore: assessment[4],
        average,
        status: assessment[5]
      };
    });
    
    // Sort by date with next assessment first
    assessmentsData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Find next assessment (scheduled)
    const nextAssessment = assessmentsData.find(a => a.status === 'Scheduled') || {
      date: 'Apr 15',
      name: 'Unit Test 3'
    };
    
    // Find last completed assessment average
    const lastCompletedAssessment = assessmentsData.filter(a => a.status === 'Completed' && a.average).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    const lastAssessmentAverage = lastCompletedAssessment ? lastCompletedAssessment.average : 76;
    
    // Count pending grades (assessments without grades)
    const pendingGrades = assessmentsData.filter(a => a.status === 'Completed' && !a.average).length;
    
    // Create grade distribution data
    const gradeDistribution = [
      { grade: 'A', count: grades.filter(g => g[4] === 'A').length || 5 },
      { grade: 'B', count: grades.filter(g => g[4] === 'B').length || 12 },
      { grade: 'C', count: grades.filter(g => g[4] === 'C').length || 18 },
      { grade: 'D', count: grades.filter(g => g[4] === 'D').length || 8 },
      { grade: 'F', count: grades.filter(g => g[4] === 'F').length || 2 }
    ];
    
    // Create performance trend data
    const completedAssessments = assessmentsData
      .filter(a => a.status === 'Completed' && a.average)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);
    
    const performanceTrend = completedAssessments.map(a => ({
      assessment: a.title,
      average: a.average
    }));
    
    // Fill in with sample data if needed
    if (performanceTrend.length < 3) {
      performanceTrend.push({ assessment: 'Unit Test 1', average: 72 });
      performanceTrend.push({ assessment: 'Mid Term', average: 76 });
      performanceTrend.push({ assessment: 'Unit Test 2', average: 78 });
      performanceTrend.push({ assessment: 'Assignment 3', average: 82 });
    }
    
    res.status(200).json({
      nextAssessment: {
        date: nextAssessment.date,
        name: nextAssessment.title || nextAssessment.name
      },
      lastAssessmentAverage,
      pendingGrades,
      assessments: assessmentsData,
      gradeDistribution,
      performanceTrend
    });
    
  } catch (error) {
    console.error('Error fetching assessments data:', error);
    res.status(500).json({ success: false, message: 'Server error fetching assessments data' });
  }
});

// Syllabus Data
app.get('/api/syllabus-data', async (req, res) => {
  try {
    // Fetch syllabus data from Google Sheets
    const syllabusResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Syllabus!A:J', // Sheet name and range
    });
    
    const syllabusRows = syllabusResponse.data.values || [];
    
    // Skip header row
    const syllabusData = syllabusRows.slice(1);
    
    // Count units and completion status
    const totalUnits = new Set(syllabusData.map(row => row[1])).size;
    const completedUnits = new Set(syllabusData.filter(row => row[5] === 'Completed').map(row => row[1])).size;
    
    // Calculate overall completion percentage
    const totalTopics = syllabusData.length;
    const completedTopics = syllabusData.filter(row => row[5] === 'Completed').length;
    const completionPercentage = Math.round((completedTopics / totalTopics) * 100);
    
    // Remaining teaching days (sample value)
    const remainingDays = 45;
    
    // Process topics
    const topics = syllabusData.map(row => ({
      id: row[0],
      unit: row[1],
      name: row[2],
      expectedHours: row[3],
      timeSpent: row[4] || null,
      status: row[5],
      startDate: row[6] || null,
      completionDate: row[7] || null
    }));
    
    // Calculate unit completion percentages
    const units = Array.from(new Set(syllabusData.map(row => row[1])));
    const unitCompletion = units.map(unit => {
      const unitTopics = syllabusData.filter(row => row[1] === unit);
      const unitCompletedTopics = unitTopics.filter(row => row[5] === 'Completed');
      const percentage = Math.round((unitCompletedTopics.length / unitTopics.length) * 100);
      
      return {
        unit,
        percentage
      };
    });
    
    // Calculate time allocation
    const topicGroups = Array.from(new Set(syllabusData.map(row => row[8] || 'Other')));
    const timeAllocation = topicGroups.map(topic => {
      const topicRows = syllabusData.filter(row => (row[8] || 'Other') === topic);
      const planned = topicRows.reduce((sum, row) => sum + (parseInt(row[3]) || 0), 0);
      const actual = topicRows.reduce((sum, row) => sum + (parseInt(row[4]) || 0), 0);
      
      return {
        topic,
        planned,
        actual: actual || Math.floor(planned * (0.8 + Math.random() * 0.4)) // Sample if no actual data
      };
    });
    
    // Get upcoming topics (not started)
    const upcomingTopics = topics
      .filter(topic => topic.status === 'Pending')
      .slice(0, 5)
      .map(topic => ({
        id: topic.id,
        name: topic.name,
        unit: topic.unit,
        plannedStart: topic.startDate || 'Next Week',
        estimatedHours: topic.expectedHours
      }));
    
    res.status(200).json({
      completionPercentage,
      completedUnits,
      totalUnits,
      remainingDays,
      topics,
      unitCompletion,
      timeAllocation,
      upcomingTopics
    });
    
  } catch (error) {
    console.error('Error fetching syllabus data:', error);
    res.status(500).json({ success: false, message: 'Server error fetching syllabus data' });
  }
});

// Calendar Data
app.get('/api/calendar-data', async (req, res) => {
  try {
    // Fetch events data from Google Sheets
    const eventsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Events!A:E', // Sheet name and range
    });
    
    const eventsRows = eventsResponse.data.values || [];
    
    // Skip header row
    const events = eventsRows.slice(1).map(row => ({
      id: row[0],
      date: row[1],
      title: row[2],
      type: row[3],
      time: row[4] || 'All Day',
      description: row[5] || ''
    }));
    
    // Generate calendar data (sample data for demonstration)
    const today = new Date();
    const calendarData = [];
    
    // Generate 5 weeks of calendar data
    for (let week = 0; week < 5; week++) {
      const weekData = [];
      
      for (let day = 0; day < 7; day++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() - today.getDay() + day + (week * 7));
        
        const dateStr = currentDate.toISOString().slice(0, 10);
        const dateNum = currentDate.getDate();
        
        // Find events for this date
        const dayEvents = events
          .filter(event => event.date === dateStr)
          .map(event => ({
            id: event.id,
            title: event.title,
            type: event.type.toLowerCase(),
            time: event.time
          }));
        
        weekData.push({
          date: dateNum,
          isCurrentMonth: currentDate.getMonth() === today.getMonth(),
          isToday: dateStr === today.toISOString().slice(0, 10),
          events: dayEvents
        });
      }
      
      calendarData.push(weekData);
    }
    
    // Get upcoming events
    const upcomingEvents = events
      .filter(event => new Date(event.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);
    
    res.status(200).json({
      calendarData,
      upcomingEvents
    });
    
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    res.status(500).json({ success: false, message: 'Server error fetching calendar data' });
  }
});

// Communications Data
app.get('/api/communications-data', async (req, res) => {
  try {
    // Fetch communications data from Google Sheets
    const communicationsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Communications!A:G', // Sheet name and range
    });
    
    // Fetch parent directory
    const parentsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Parents!A:G', // Sheet name and range
    });
    
    const communicationsRows = communicationsResponse.data.values || [];
    const parentsRows = parentsResponse.data.values || [];
    
    // Skip header rows
    const communications = communicationsRows.slice(1);
    const parents = parentsRows.slice(1);
    
    // Process communication logs
    const communicationLogs = communications.map(row => ({
      id: row[0],
      date: row[1],
      student: row[2],
      parent: row[3],
      type: row[4],
      subject: row[5],
      status: row[6]
    }));
    
    // Process parent directory
    const parentDirectory = parents.map(row => ({
      id: row[0],
      student: row[1],
      name: row[2],
      relation: row[3],
      phone: row[4],
      email: row[5],
      lastContact: row[6] || null
    }));
    
    // Calculate statistics
    const parentMeetings = communications.filter(c => c[4] === 'Meeting' && new Date(c[1]).getMonth() === new Date().getMonth()).length;
    const pendingResponses = communications.filter(c => c[6] === 'Pending').length;
    
    // Sample next PTM data
    const nextPTM = {
      date: 'Apr 20',
      time: '09:00 AM',
      day: 'Saturday'
    };
    
    res.status(200).json({
      parentMeetings,
      pendingResponses,
      nextPTM,
      communicationLogs,
      parentDirectory
    });
    
  } catch (error) {
    console.error('Error fetching communications data:', error);
    res.status(500).json({ success: false, message: 'Server error fetching communications data' });
  }
});

// Student Details
app.get('/api/student-details/:id', async (req, res) => {
  try {
    const studentId = req.params.id;
    
    // Fetch student data from Google Sheets
    const studentResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Students!A:G', // Sheet name and range
    });
    
    // Fetch performance data
    const performanceResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Performance!A:H', // Sheet name and range including report, strengths, weaknesses
    });
    
    // Fetch discipline records
    const disciplineResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Discipline!A:E', // Sheet name and range
    });
    
    // Fetch achievements
    const achievementsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Achievements!A:E', // Sheet name and range
    });
    
    const studentRows = studentResponse.data.values || [];
    const performanceRows = performanceResponse.data.values || [];
    const disciplineRows = disciplineResponse.data.values || [];
    const achievementsRows = achievementsResponse.data.values || [];
    
    // Skip header rows
    const students = studentRows.slice(1);
    const performances = performanceRows.slice(1);
    const disciplines = disciplineRows.slice(1);
    const achievements = achievementsRows.slice(1);
    
    // Find the student
    const student = students.find(s => s[0] === studentId);
    
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    
    // Find performance data
    const performance = performances.find(p => p[0] === studentId) || [];
    
    // Find discipline records
    const disciplineRecords = disciplines
      .filter(d => d[3] === studentId)
      .map(d => ({
        id: d[0],
        date: d[1],
        incident: d[4],
        action: d[5] || 'Verbal Warning'
      }));
    
    // Find achievements
    const studentAchievements = achievements
      .filter(a => a[2] === student[1])
      .map(a => a[3]);
    
    // Parse performance data
    const strengths = performance[3] ? performance[3].split(',').map(s => s.trim()) : [];
    const weaknesses = performance[4] ? performance[4].split(',').map(w => w.trim()) : [];
    const suggestions = performance[5] ? performance[5].split(',').map(s => s.trim()) : [];
    
    const studentDetails = {
      rollNo: student[0],
      name: student[1],
      gender: student[2],
      category: student[3],
      serviceCategory: student[4],
      contact: student[5],
      class: student[6] || 'X-A',
      performanceReport: performance[6] || 'The student shows consistent effort in academics.',
      strengths,
      weaknesses,
      suggestions,
      disciplineRecords,
      achievements: studentAchievements
    };
    
    res.status(200).json(studentDetails);
    
  } catch (error) {
    console.error('Error fetching student details:', error);
    res.status(500).json({ success: false, message: 'Server error fetching student details' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
