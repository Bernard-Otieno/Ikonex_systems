import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient'; // Connected to your Supabase credentials
import { useReactToPrint } from 'react-to-print';
import { ReportCard } from './ReportCard';

// ==========================================
// SECTION 1: DATA TYPES & SCHEMAS
// ==========================================

// Defines what a Class Stream record looks like coming from the database
interface Stream {
  id: number;
  name: string;
}

// Defines what a Student record looks like coming from the database
interface Student {
  id: number;
  admission_number: string;
  first_name: string;
  last_name: string;
  stream_id: number;
}
// Blueprint for an individual subject in the global library
interface Subject {
  id: number;
  name: string;
  code: string;
}

// Blueprint for the intersection mapping linking a subject to a class stream
interface SubjectStreamMapping {
  id: number;
  subject_id: number;
  stream_id: number;
}

// Blueprint for student test scores stored in the database
// Blueprint mirroring your upcoming optimized database table columns
interface Score {
  id: number;
  student_id: number;
  subject_id: number;
  CAT_1: number | null;
  CAT_2: number | null;
  final_exam: number | null;
  final_grade: number | null; // Stores the final compiled numeric mark (0-100) for comparisons
}

export default function App() {
  // Navigation active tab controller
  const [activeTab, setActiveTab] = useState<'streams' | 'students' | 'subjects' | 'scores' | 'rankings'>('streams');
  // --- TRACKER STATE FOR DETAILED STREAM VIEWING ---
  const [selectedDetailedStreamId, setSelectedDetailedStreamId] = useState<number | null>(null);

  // App-wide data states
  const [streams, setStreams] = useState<Stream[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  // Form input state for capturing the name of the new stream
  const [newStreamName, setNewStreamName] = useState('');
  // --- STUDENT REGISTRY FORM STATES ---
  const [studentForm, setStudentForm] = useState({
    id: null as number | null,         // If null, we are adding a new student. If it holds an ID, we are updating.
    admission_number: '',
    first_name: '',
    last_name: '',
    stream_id: ''                      // Holds the selected stream ID string from the dropdown
  });
  const [isEditingStudent, setIsEditingStudent] = useState(false); // Flags if form should show "Update" instead of "Register"
  const [selectedStreamFilter, setSelectedStreamFilter] = useState<string>('all'); // Controls directory filtering dropdown
  // --- SUBJECT STATE MEMORY CELLS ---
  const [subjects, setSubjects] = useState<Subject[]>([]); // Array list for all subjects in the library
  const [subjectMappings, setSubjectMappings] = useState<SubjectStreamMapping[]>([]); // Array list tracking active assignments
  // --- SELECTION DROPDOWN STATE FOR NEW STUDENT ASSIGNMENT ---
  const [selectedStreamId, setSelectedStreamId] = useState<number | null>(null);
  // Dedicated state for new student registration stream assignment 
  const [registrationStreamId, setRegistrationStreamId] = useState<string>('');

  // --- SUBJECT INPUT FORM STATES ---
  const [newSubjectName, setNewSubjectName] = useState(''); // Stores the typed name for a brand new subject
  const [selectedMappingStream, setSelectedMappingStream] = useState(''); // Tracks the chosen stream from the assignment dropdown
  const [selectedMappingSubject, setSelectedMappingSubject] = useState(''); // Tracks the chosen subject from the assignment dropdown
  // New input state for capturing the unique shorthand code of a subject
  const [newSubjectCode, setNewSubjectCode] = useState('');
  // --- SCORES STATE MEMORY CELLS ---
  const [scores, setScores] = useState<Score[]>([]); // Array containing all recorded student score

  // --- FILTERS & ENTRY CONTROL STATES ---
  const [selectedScoreStream, setSelectedScoreStream] = useState('');   // Filter: Selected Class Stream
  const [selectedScoreSubject, setSelectedScoreSubject] = useState<string | null>(null); // Filter: Selected Subject
  
  // --- STATE REGISTERS FOR THE RECONFIGURED ASSESSMENT COLUMNS ---
  const [editingCAT1, setEditingCAT1] = useState<{ [studentId: number]: string }>({});
  const [editingCAT2, setEditingCAT2] = useState<{ [studentId: number]: string }>({});
  const [editingFinalExam, setEditingFinalExam] = useState<{ [studentId: number]: string }>({});
  // --- TRACKER STATE FOR DETAILED STUDENT PROFILE VIEWING ---
  const [selectedDetailedStudentId, setSelectedDetailedStudentId] = useState<number | null>(null);
  // --- SUB-ENTRY FORM FOR NEW REGISTRATIONS (IF NOT YET APPLIED) ---
  const [newAdmissionNumber, setNewAdmissionNumber] = useState<string>('');
  const [newFirstName, setNewFirstName] = useState<string>('');
  const [newLastName, setNewLastName] = useState<string>('');
  // --- INLINE SUBJECT EDITING REGISTERS ---
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);
  const [editSubjectName, setEditSubjectName] = useState<string>('');
  const [editSubjectCode, setEditSubjectCode] = useState<string>('');

  // Look for a previously recorded database row matching this student + subject combination


// Form state selectors: prioritize active typing edits, fallback to existing saved numbers, or default to an empty string

  // ==========================================
  // SECTION 2: INITIAL DATA LIFECYCLE
  // ==========================================
  useEffect(() => {
    fetchStreams();
    fetchStudents();
    fetchSubjects();
    fetchSubjectMappings();
    fetchScores();
 
  }, []);   
 

  const handleAddStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStreamName.trim()) {
      alert("Stream name cannot be empty.");
      return;
    }
    
    // Insert new row into the 'streams' table
    const { error } = await supabase
      .from('streams')
      .insert([{ name: newStreamName.trim() }]);

    if (error) {
      alert(`Error creating stream: ${error.message}`);
    } else {
      setNewStreamName(''); // Clear input box on success
      fetchStreams();       // Refresh stream data list immediately
    }
  };



  // Handles saving a student record (Both new registrations and existing profile updates)
const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();

    // Ensure we are working with the latest form data
    const studentData = {
      admission_number: studentForm.admission_number,
      first_name: studentForm.first_name,
      last_name: studentForm.last_name,
      // Convert the string back to a number for Supabase
      stream_id: Number(studentForm.stream_id) 
    };

    let error;
    if (studentForm.id !== 0) {
      // Perform an update if an ID exists
      const res = await supabase
        .from('students')
        .update(studentData)
        .eq('id', studentForm.id);
      error = res.error;
    } else {
      // Perform an insert if no ID
      const res = await supabase
        .from('students')
        .insert([studentData]);
      error = res.error;
    }

    if (error) {
      alert(`Error saving student: ${error.message}`);
    } else {
      alert("Student record saved successfully!");
      setIsEditingStudent(false);
      // Reset form
      setStudentForm({ id: 0, admission_number: '', first_name: '', last_name: '', stream_id: '' });
      fetchStudents(); // Refresh the list
    }
  };

  // Fills the input form fields with an existing student's data to allow modifications
  const handleEditStudentClick = (student: Student) => {
    setStudentForm({
      id: student.id,
      admission_number: student.admission_number,
      first_name: student.first_name,
      last_name: student.last_name,
      stream_id: String(student.stream_id)
    });
    setIsEditingStudent(true);
  };




  // Handles removing a student entirely from the institution records
  const handleDeleteStudent = async (id: number) => {
    if (!confirm("Are you certain you want to remove this student profile permanently?")) return;
    
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);
      
    if (error) alert(`Error deleting student: ${error.message}`);
    else fetchStudents(); // Refresh view state
  };



  // 1. Fetches the master subject inventory list from your database
  const fetchSubjects = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('name', { ascending: true });
    if (!error && data) setSubjects(data);
    setLoading(false);
  };



  // 2. Fetches active linkages showing which subjects are connected to which streams
  const fetchSubjectMappings = async () => {
    const { data, error } = await supabase
      .from('subject_streams') // Reaching out to your relational junction table
      .select('*');
    if (!error && data) setSubjectMappings(data);
  };

  // 3. Submits a brand new academic subject to the global database library
// Submits a brand new academic subject with its code to the global database library
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that both fields are populated before sending
    if (!newSubjectName.trim() || !newSubjectCode.trim()) {
      alert("Please enter both a subject name and a subject code.");
      return;
    }
    
    // Insert both name and uppercase code fields into the database
    const { error } = await supabase
      .from('subjects')
      .insert([{ 
        name: newSubjectName.trim(),
        code: newSubjectCode.trim().toUpperCase() // Keeping codes neat and capitalized
      }]);

    if (error) {
      alert(`Error creating subject: ${error.message}`);
    } else {
      setNewSubjectName(''); // Clear name field
      setNewSubjectCode(''); // Clear code field <--- Add this line
      fetchSubjects();       // Refresh the local state pool immediately
    }
  };

  // 4. Binds an existing subject directly to a class stream configuration row
  const handleAssignSubjectToStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMappingStream || !selectedMappingSubject) {
      alert("Please ensure both a class stream and a subject are chosen.");
      return;
    }

    // Guard Clause: Prevent creating an identical mapping that already exists
    const isDuplicate = subjectMappings.some(
      m => m.stream_id === Number(selectedMappingStream) && m.subject_id === Number(selectedMappingSubject)
    );
    if (isDuplicate) {
      alert("This specific subject is already attached to that class stream layout.");
      return;
    }

    const { error } = await supabase
      .from('subject_streams')
      .insert([{
        stream_id: Number(selectedMappingStream),
        subject_id: Number(selectedMappingSubject)
      }]);

    if (error) {
      alert(`Mapping Error: ${error.message}`);
    } else {
      // Clear dropdown selection and update database tracking state
      setSelectedMappingSubject('');
      fetchSubjectMappings();
    }
  };

// 1. Fetches the master list of all recorded scores from your database
  const fetchScores = async () => {
    const { data, error } = await supabase.from('scores').select('*');
    if (!error && data) setScores(data);
  };

  // 2. Automated Grading Engine utility function
  const calculateGrade = (score: Score) => {
    const mark = score.final_grade ?? 0;
    if (mark >= 80) return { grade: 'A', color: 'text-emerald-600 bg-emerald-50' };
    if (mark >= 70) return { grade: 'B', color: 'text-teal-600 bg-teal-50' };
    if (mark >= 60) return { grade: 'C', color: 'text-blue-600 bg-blue-50' };
    if (mark >= 50) return { grade: 'D', color: 'text-amber-600 bg-amber-50' };
    return { grade: 'E/F', color: 'text-rose-600 bg-rose-50' };
  };

  // 3. Submits typed academic score for a specific student and subject combo directly to Supabase
 // Submits typed academic score for a specific student, subject, and CA type combo to Supabase
// Processes grades, compiles weights, and saves numeric marks directly to the database


const handleSaveSingleScore = async (studentId: number) => {
    if (!selectedScoreSubject) {
      alert("Please choose a subject scope before attempting to update grades.");
      return;
    }

    // 1. Gather raw inputs from active editing states
    const rawCat1 = editingCAT1[studentId];
    const rawCat2 = editingCAT2[studentId];
    const rawExam = editingFinalExam[studentId];

    // Find the current record using the Score interface definition
    const existingRecord: Score | undefined = scores.find(
      (sc: Score) => sc.student_id === studentId && sc.subject_id === Number(selectedScoreSubject)
    );

    // 2. Resolve final evaluation strings (Active typed value -> Existing baseline -> blank fallback)
    const finalStrCat1 = rawCat1 !== undefined ? rawCat1 : (existingRecord && existingRecord.CAT_1 !== null ? String(existingRecord.CAT_1) : '');
    const finalStrCat2 = rawCat2 !== undefined ? rawCat2 : (existingRecord && existingRecord.CAT_2 !== null ? String(existingRecord.CAT_2) : '');
    const finalStrExam = rawExam !== undefined ? rawExam : (existingRecord && existingRecord.final_exam !== null ? String(existingRecord.final_exam) : '');

    // 3. Validation Rules Rulebook Block
    if (!finalStrCat1.trim() || !finalStrCat2.trim() || !finalStrExam.trim()) {
      alert("Validation Error: All assessment vectors (CAT 1, CAT 2, and Final Exam) must be filled out before saving this row.");
      return;
    }

    const numCat1 = Number(finalStrCat1);
    const numCat2Corrected = Number(finalStrCat2);
    const numExam = Number(finalStrExam);

    // Validate that inputs are actual numeric digits
    if (isNaN(numCat1) || isNaN(numCat2Corrected) || isNaN(numExam)) {
      alert("Validation Error: Score parameters must be valid numeric digits.");
      return;
    }

    // Validate ranges explicitly are between 0 and 100
    if (numCat1 < 0 || numCat1 > 100) {
      alert(`Validation Error: CAT 1 mark (${numCat1}) falls out of bounds. Must be a value from 0 to 100.`);
      return;
    }
    if (numCat2Corrected < 0 || numCat2Corrected > 100) {
      alert(`Validation Error: CAT 2 mark (${numCat2Corrected}) falls out of bounds. Must be a value from 0 to 100.`);
      return;
    }
    if (numExam < 0 || numExam > 100) {
      alert(`Validation Error: Final Exam mark (${numExam}) falls out of bounds. Must be a value from 0 to 100.`);
      return;
    }

    // 4. Compute Weighted Grades (CATs averaged out of 100 -> 15%, Exam out of 100 -> 85%)
    const catAverage = (numCat1 + numCat2Corrected) / 2;
    const weightedCat = (catAverage / 100) * 15;
    const weightedExam = (numExam / 100) * 85;
    const totalCalculatedGrade = Math.round(weightedCat + weightedExam);

    // 5. Fire Upsert Query safely to Supabase with validated types match
    const { error } = await supabase
      .from('scores')
      .upsert({
        student_id: studentId,
        subject_id: Number(selectedScoreSubject),
        "CAT_1": numCat1,
        "CAT_2": numCat2Corrected,
        final_exam: numExam,
        final_grade: totalCalculatedGrade
      }, {
        onConflict: 'student_id,subject_id'
      });

    if (error) {
      alert(`Database Submission Error: ${error.message}`);
    } else {
      // Clear current row editing local state triggers to show clean updated database data
      const updatedEditingCat1 = { ...editingCAT1 };
      const updatedEditingCat2 = { ...editingCAT2 };
      const updatedEditingExam = { ...editingFinalExam };
      
      delete updatedEditingCat1[studentId];
      delete updatedEditingCat2[studentId];
      delete updatedEditingExam[studentId];

      setEditingCAT1(updatedEditingCat1);
      setEditingCAT2(updatedEditingCat2);
      setEditingFinalExam(updatedEditingExam);
      setSelectedDetailedStudentId(null);

      alert("Row scores evaluated and successfully committed to database!");
      fetchScores(); // Synchronize view state layout
    }
  };


// --- INLINE EDIT TOGGLE HOOK FOR SAVED REGISTRY ROWS ---
  // Copies the database record parameters back to the active tracking maps
  const startEditingSavedScore = (score: Score) => {
    setEditingCAT1(prev => ({ ...prev, [score.student_id]: score.CAT_1 !== null ? String(score.CAT_1) : '' }));
    setEditingCAT2(prev => ({ ...prev, [score.student_id]: score.CAT_2 !== null ? String(score.CAT_2) : '' }));
    setEditingFinalExam(prev => ({ ...prev, [score.student_id]: score.final_exam !== null ? String(score.final_exam) : '' }));
    
    // Use your declared profile tracker variable to toggle inline view mode to input fields
    setSelectedDetailedStudentId(score.student_id);
  };

  // --- CANCEL INLINE EDIT HOOK ---
  const cancelEditingSavedScore = (studentId: number) => {
    setSelectedDetailedStudentId(null);
    
    setEditingCAT1(prev => { const n = { ...prev }; delete n[studentId]; return n; });
    setEditingCAT2(prev => { const n = { ...prev }; delete n[studentId]; return n; });
    setEditingFinalExam(prev => { const n = { ...prev }; delete n[studentId]; return n; });
  };

  // --- DELETE EXPLICIT ROW FROM THE SCORES REGISTRY ---
  // const handleDeleteSingleScore = async (scoreId: number) => {
  //   if (!confirm("Are you sure you want to permanently delete this student's grade record from the system ledger?")) return;

  //   const { error } = await supabase
  //     .from('scores')
  //     .delete()
  //     .eq('id', scoreId);

  //   if (error) {
  //     alert(`Database Deletion Error: ${error.message}`);
  //   } else {
  //     alert("Score record removed successfully from database ledger.");
  //     fetchScores(); // Synchronize view state layout using your native fetch engine
  //   }
  // };

  

  // Performs client-side array filtering based on the stream filtering dropdown choice
  const filteredStudents = selectedStreamFilter === 'all' ? students : students.filter(s => String(s.stream_id) === selectedStreamFilter);

  // Reads the master class stream rows from your database
  const fetchStreams = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('streams').select('*').order('name', { ascending: true });
    if (!error && data) setStreams(data);
    setLoading(false);
  };

  // Reads the master student registry list from your database
  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('students').select('*').order('created_at', { ascending: false });
    if (!error && data) setStudents(data);
    setLoading(false);
  };

// const handleAddStudent = async () => {
//     if (!newAdmissionNumber.trim() || !newFirstName.trim() || !newLastName.trim() || !registrationStreamId) {
//       alert("Please fill out all student registration fields completely.");
//       return;
//     }

//     const { error } = await supabase
//       .from('students')
//       .insert([{
//         admission_number: newAdmissionNumber.trim().toUpperCase(),
//         first_name: newFirstName.trim(),
//         last_name: newLastName.trim(),
//         stream_id: Number(registrationStreamId) // Uses the new unlinked state variable
//       }]);

//     if (error) {
//       alert(`Registration Error: ${error.message}`);
//     } else {
//       // Clear input form values upon successful creation
//       setNewAdmissionNumber('');
//       setNewFirstName('');
//       setNewLastName('');
//       setRegistrationStreamId(''); // Resets the dropdown back to "-- Choose Stream --" safely
//       fetchStudents(); // Sync local screen memory layout
//     }
//   };
// --- OPERATIONS FOR CURRICULUM SUBJECT ENTRIES ---

  // PUT Operation: Amends updated titles/codes on a specific subject index
  const handleUpdateSubject = async (id: number) => {
    if (!editSubjectName.trim() || !editSubjectCode.trim()) {
      alert("Subject title or course code definitions cannot be saved blank.");
      return;
    }

    const { error } = await supabase
      .from('subjects')
      .update({ name: editSubjectName.trim(), code: editSubjectCode.trim().toUpperCase() })
      .eq('id', id);

    if (error) {
      alert(`Update Error: ${error.message}`);
    } else {
      setEditingSubjectId(null);
      fetchSubjects(); // Refresh local application memory layout
    }
  };

  // DELETE Operation: Wipes a subject index out of the cloud infrastructure
  const handleDeleteSubject = async (id: number) => {
    if (!confirm("Are you sure you want to delete this subject? Warning: This will wipe out all corresponding teacher grade entries and stream mappings for this subject!")) {
      return;
    }

    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id);

    if (error) {
      alert(`Delete Error: ${error.message}`);
    } else {
      // Clean up local editing pointers if the active item was wiped
      if (editingSubjectId === id) setEditingSubjectId(null);
      
      // Sync all state containers completely
      fetchSubjects();
      fetchSubjectMappings();
      fetchScores();
    }
  };


  const getRankedStudents = (studentsInStream: Student[], scores: Score[]) => {
    return studentsInStream
      .map(student => {
        // Find the student's score in the specific stream
        const score = scores.find(s => s.student_id === student.id);
        return {
          ...student,
          final_grade: score?.final_grade ?? 0
        };
      })
      .sort((a, b) => b.final_grade - a.final_grade); // Sort descending
  };
  const getRankingsByStream = (streamId: number) => {
  return students
    .filter(s => s.stream_id === streamId)
    .map(student => {
      const score = scores.find(s => s.student_id === student.id);
      return { ...student, final_grade: score?.final_grade ?? 0 };
    })
    .sort((a, b) => b.final_grade - a.final_grade);
};


  const downloadAllReports = () => {
  students.forEach(student => {
    // 1. Filter scores for this specific student
    const studentScores = scores.filter(s => s.student_id === student.id);
    
    // 2. Find their stream name
    const stream = streams.find(s => s.id === student.stream_id)?.name || "N/A";
    
    // 3. Trigger the generation logic
    // You can use a library like 'jspdf' or 'react-to-print' 
    // to trigger the PDF download in the browser.
    initiatePrint(student);
    
  });
  
};
  
// Inside your component
const [printingStudent, setPrintingStudent] = useState<any>(null);
const printRef = useRef(null);

const handlePrint = useReactToPrint({
  contentRef: printRef,
  documentTitle: `ReportCard_${printingStudent?.first_name}`,
  suppressErrors: false, // <--- Change this to false
});

// The function to trigger the flow
const initiatePrint = (student: any) => {
  setPrintingStudent(student);
  // Small timeout to allow state to update and component to mount
  setTimeout(() => {
    if (printRef.current) {
      handlePrint();
    }
  }, 500);  
  setPrintingStudent(student);
  setShouldPrint(true); // This kicks off the useEffect
};

const [shouldPrint, setShouldPrint] = useState(false);

 useEffect(() => {
  if (shouldPrint && printRef.current) {
    handlePrint();
    setShouldPrint(false); // Reset the trigger
  }
}, [shouldPrint]);


















  // ==========================================
  // SECTION 3: THE MAIN APPLICATION VIEW SHELL
  // ==========================================
  return (
    <div className="flex h-screen bg-slate-50 font-sans antialiased text-slate-800">
      
      {/* Sidebar Navigation */}
      <div className="w-64 bg-slate-900 text-white flex flex-col shadow-xl">
        <div className="p-6 text-xl font-black tracking-wider border-b border-slate-800 text-indigo-400">
          IKONEX ACADEMY
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => setActiveTab('streams')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm transition ${activeTab === 'streams' ? 'bg-indigo-600 font-semibold text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <span>🏫</span> <span>Class Streams</span>
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm transition ${activeTab === 'students' ? 'bg-indigo-600 font-semibold text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <span>👨‍🎓</span> <span>Students Manager</span>
          </button>
          <button
            onClick={() => setActiveTab('subjects')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm transition ${activeTab === 'subjects' ? 'bg-indigo-600 font-semibold text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <span>📚</span> <span>Subject Settings</span>
          </button>
          <button
            onClick={() => setActiveTab('scores')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm transition ${activeTab === 'scores' ? 'bg-indigo-600 font-semibold text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <span>📝</span> <span>Scores & Grading</span>
          </button>
          <button 
            onClick={() => setActiveTab('rankings')} 
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm transition ${activeTab === 'rankings' ? 'bg-indigo-600 font-semibold text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
           <span>🏆</span> <span>Rankings</span>
          </button>
        </nav>
        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
          Admin Environment v1.0
        </div>
      </div>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center sticky top-0 z-10">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 capitalize">
            {activeTab} Management Module
          </h1>
          {loading && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full animate-pulse">
              Syncing live with Supabase...
            </span>
          )}
        </header>

        {/* This container area changes view depending on the selected tab */}
        <main className="p-8 max-w-7xl w-full mx-auto">



          {/* ================= STREAMS MANAGEMENT & DETAILED PROFILE Terminal ================= */}
          {activeTab === 'streams' && (
            <div className="space-y-6">
              
              {!selectedDetailedStreamId ? (
                <>
                  {/* Standard Form Header Block for Stream Entry */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">
                      Register Fresh Class Stream
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        placeholder="e.g., Form 1 West, Grade 6 Blue"
                        value={newStreamName}
                        onChange={(e) => setNewStreamName(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                          onClick={handleAddStream}
                          className="bg-indigo-600 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-indigo-700 transition whitespace-nowrap"
                        >
                          + Create Stream
                      </button>
                    </div>
                  </div>

                  {/* Streams Directory Listing Grid */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Active Institutional Streams
                      </h3>
                    </div>

                    {streams.length === 0 ? (
                      <p className="text-sm text-slate-500 italic text-center py-8">No active streams established yet.</p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {streams.map((stream) => {
                          const streamStudentsCount = students.filter(s => s.stream_id === stream.id).length;
                          const streamSubjectsCount = subjectMappings.filter(m => m.stream_id === stream.id).length;

                          return (
                            <div key={stream.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition">
                              <div>
                                <h4 className="font-semibold text-slate-800 text-sm">{stream.name}</h4>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  👥 {streamStudentsCount} Registered Students &nbsp;|&nbsp; 📚 {streamSubjectsCount} Assigned Frameworks
                                </p>
                              </div>
                              <button
                                onClick={() => setSelectedDetailedStreamId(Number(stream.id))}
                                className="border border-slate-200 text-slate-600 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition"
                              >
                                View Breakdown →
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* ================= SINGLE CLASS STREAM DETAILED DASHBOARD BREAKDOWN ================= */
                (() => {
                  const targetStream = streams.find(s => s.id === selectedDetailedStreamId);
                  if (!targetStream) return <p className="text-sm text-red-500">Stream context offline.</p>;

                  const roster = students.filter(s => s.stream_id === targetStream.id);
                  const assignedLinks = subjectMappings.filter(m => m.stream_id === targetStream.id);
                  
                  return (
                    <div className="space-y-6 animate-fadeIn">
                      
                      {/* Header with Back button */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setSelectedDetailedStreamId(null)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
                          >
                            🔙 Back
                          </button>
                          <h2 className="text-xl font-bold text-slate-900">{targetStream.name}</h2>
                        </div>
                      </div>

                      {/* MAPPING FORM: Add this block to enable subject allocation */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Allocate New Subject</h4>
                        <form 
                          onSubmit={(e) => { 
                            // Set the current stream ID as the target for the mapping
                            setSelectedMappingStream(targetStream.id.toString());
                            handleAssignSubjectToStream(e); 
                          }} 
                          className="flex gap-3"
                        >
                          <select
                            value={selectedMappingSubject}
                            onChange={(e) => setSelectedMappingSubject(e.target.value)}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs"
                            required
                          >
                            <option value="">Select a subject to add...</option>
                            {subjects.map(sub => (
                              <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                            ))}
                          </select>
                          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700">
                            Add Subject
                          </button>
                        </form>
                      </div>

                      {/* Metrics Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center gap-4">
                          <span className="text-2xl">👥</span>
                          <div>
                            <span className="block text-[11px] font-bold text-indigo-500 uppercase">Roster Size</span>
                            <span className="text-xl font-black text-slate-800">{roster.length} students</span>
                          </div>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-4">
                          <span className="text-2xl">📚</span>
                          <div>
                            <span className="block text-[11px] font-bold text-emerald-500 uppercase">Subject Scope</span>
                            <span className="text-xl font-black text-slate-800">{assignedLinks.length} mappings</span>
                          </div>
                        </div>
                      </div>

                      {/* Columns: Subject Frameworks vs Student Roster */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden h-fit">
                          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-500 uppercase">Mapped Subjects</div>
                          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                            {assignedLinks.length === 0 ? <p className="p-4 text-xs text-slate-400 italic">No subjects added.</p> :
                            assignedLinks.map(link => {
                              const sub = subjects.find(s => s.id === link.subject_id);
                              return sub && (
                                <div key={link.id} className="p-3 text-xs flex justify-between">
                                  <span className="font-semibold text-slate-700">{sub.name}</span>
                                  <span className="font-mono text-slate-400">{sub.code}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm lg:col-span-2">
                          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-500 uppercase">Student Roster</div>
                          <div className="overflow-x-auto max-h-80 overflow-y-auto">
                            <table className="w-full text-left text-xs">
                              <tbody className="divide-y divide-slate-100">
                                {roster.map(student => (
                                  <tr key={student.id}>
                                    <td className="px-4 py-3 font-mono font-bold text-indigo-600">{student.admission_number}</td>
                                    <td className="px-4 py-3 font-medium text-slate-700">{student.first_name} {student.last_name}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                 );
              })()
            )}
          </div>
        )}



              {activeTab === 'students' && (
                <div className="space-y-6 animate-fadeIn">
                  
                  {/* 1. REGISTRATION & EDIT FORM */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
                    <div className="border-b border-slate-100 pb-3 mb-4">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                        {studentForm.id !== 0 ? "Edit Student Profile" : "Register New Student"}
                      </h3>
                    </div>
                    
                    <form onSubmit={handleSaveStudent} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <input
                        placeholder="Admission No."
                        value={studentForm.admission_number}
                        onChange={(e) => setStudentForm({...studentForm, admission_number: e.target.value})}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold uppercase"
                        required
                      />
                      <input
                        placeholder="First Name"
                        value={studentForm.first_name}
                        onChange={(e) => setStudentForm({...studentForm, first_name: e.target.value})}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs"
                        required
                      />
                      <input
                        placeholder="Last Name"
                        value={studentForm.last_name}
                        onChange={(e) => setStudentForm({...studentForm, last_name: e.target.value})}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs"
                        required
                      />
                      <select
                        value={studentForm.stream_id}
                        onChange={(e) => setStudentForm({...studentForm, stream_id: e.target.value})}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs"
                        required
                      >
                        <option value="">Select Stream</option>
                        {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>

                      <div className="md:col-span-4 flex gap-2 pt-2">
                        <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-emerald-700">
                          {studentForm.id !== 0 ? "Update Record" : "Register Student"}
                        </button>
                        {studentForm.id !== 0 && (
                          <button type="button" onClick={() => setStudentForm({id: 0, admission_number: '', first_name: '', last_name: '', stream_id: ''})} className="bg-slate-200 px-4 py-2 rounded-lg text-xs font-bold">
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                  </div>

                  {/* 2. STUDENT MANIFEST TABLE */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <div className="p-4 bg-slate-50 border-b border-slate-200">
                      <h4 className="text-xs font-bold text-slate-700 uppercase">System Account Manifest</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase">
                            <th className="px-4 py-3">Adm Number</th>
                            <th className="px-4 py-3">Full Name</th>
                            <th className="px-4 py-3">Stream</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                            <th className="px-4 py-3 text-right">Report</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {students.map((student) => (
                            <tr key={student.id} className="text-xs hover:bg-slate-50">
                              <td className="px-4 py-3 font-mono font-bold text-indigo-600">{student.admission_number}</td>
                              <td className="px-4 py-3 font-medium">{student.first_name} {student.last_name}</td>
                              <td className="px-4 py-3 text-slate-600">{streams.find(s => s.id === student.stream_id)?.name}</td>
                              
                              {/* COMBINED ACTIONS COLUMN */}
                              <td className="px-4 py-3 text-right space-x-3">
                                <button onClick={() => handleEditStudentClick(student)} className="text-indigo-600 hover:underline font-bold">Edit</button>
                                <button onClick={() => handleDeleteStudent(student.id)} className="text-red-600 hover:underline font-bold">Delete</button>
                              </td>
                              
                              {/* REPORT COLUMN */}
                              <td className="px-4 py-3 text-right">
                                <button 
                                  onClick={() => initiatePrint(student)} 
                                  className="text-emerald-600 hover:underline font-bold text-xs"
                                >
                                  Print Report
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}












          {/* ================= SUBJECTS FRAMEWORK terminal WITH EDIT & DELETE ================= */}
          {activeTab === 'subjects' && (
            <div className="space-y-6">
              
              {/* Fresh Registry Input Node Card */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">
                  Register Fresh Curriculum Subject
                </h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="Subject Title (e.g., Mathematics, Kiswahili)"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Subject Code (e.g., MAT101, KIS)"
                    value={newSubjectCode}
                    onChange={(e) => setNewSubjectCode(e.target.value)}
                    className="w-full sm:w-48 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleAddSubject}
                    className="bg-indigo-600 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-indigo-700 transition whitespace-nowrap"
                  >
                    + Register Subject
                  </button>
                </div>
              </div>

              {/* Subjects Directory Management Grid */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Active Curriculum Catalogue
                  </h3>
                </div>

                {subjects.length === 0 ? (
                  <p className="text-sm text-slate-500 italic text-center py-8">No subjects listed in the catalogue.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {subjects.map((subject) => {
                      const isEditing = editingSubjectId === subject.id;

                      return (
                        <div key={subject.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition">
                          
                          {isEditing ? (
                            /* Inline Active Input Editors Form Row */
                            <div className="flex-1 flex flex-col sm:flex-row gap-2">
                              <input
                                type="text"
                                value={editSubjectName}
                                onChange={(e) => setEditSubjectName(e.target.value)}
                                className="flex-1 bg-white border border-indigo-300 rounded px-2 py-1 text-sm focus:outline-none font-medium"
                              />
                              <input
                                type="text"
                                value={editSubjectCode}
                                onChange={(e) => setEditSubjectCode(e.target.value)}
                                className="w-full sm:w-32 bg-white border border-indigo-300 rounded px-2 py-1 text-sm font-mono uppercase focus:outline-none"
                              />
                            </div>
                          ) : (
                            /* Standard View Output Text Display Row */
                            <div>
                              <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                                {subject.name}
                                <span className="font-mono bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-xs text-slate-500 font-bold">
                                  {subject.code}
                                </span>
                              </h4>
                            </div>
                          )}

                          {/* Control Action Buttons Row */}
                          <div className="flex items-center gap-2 justify-end">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleUpdateSubject(Number(subject.id))}
                                  className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition"
                                >
                                  Save Change
                                </button>
                                <button
                                  onClick={() => setEditingSubjectId(null)}
                                  className="bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-300 transition"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingSubjectId(Number(subject.id));
                                    setEditSubjectName(subject.name);
                                    setEditSubjectCode(subject.code);
                                  }}
                                  className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg hover:bg-indigo-600 hover:text-white transition"
                                >
                                  Edit Info
                                </button>
                                <button
                                  onClick={() => handleDeleteSubject(Number(subject.id))}
                                  className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg hover:bg-rose-600 hover:text-white transition"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}






        {/* ================= MULTI-COLUMN ASSESSMENT PANEL WITH EXPLICIT LABELS ================= */}
        {activeTab === 'scores' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* --- COMPACT FILTER MODULE DASHBOARD --- */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <div className="border-b border-slate-100 pb-3 mb-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    Scores & Academic Grading Desk
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select a class stream and target subject scope to view, input, modify, or remove student grades.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-tight mb-1">
                      Class Stream Selector
                    </label>
                   <select
                          // Use String() conversion to ensure the component receives a string 
                          // even if the state is a number
                          value={selectedStreamId !== null ? String(selectedStreamId) : ''}
                          
                          // Use Number() to convert the string back to a number for your state
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedStreamId(val === '' ? null : Number(val));
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 focus:bg-white focus:outline-indigo-500 transition"
                        >
                          <option value="">-- Choose Class Stream --</option>
                          {streams.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-tight mb-1">
                      Subject Scope
                    </label>
                    <select
                      value={selectedScoreSubject || ''}
                      onChange={(e) => setSelectedScoreSubject(e.target.value || '')}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 focus:bg-white focus:outline-indigo-500 transition"
                    >
                      <option value="">-- Choose Subject Scope --</option>
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>[{sub.code}] {sub.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* UNSELECTED INCOMPLETE FILTER STATE */}
              {(!selectedStreamId || !selectedScoreSubject) && (
                <div className="bg-slate-50/50 border border-dashed border-slate-200 rounded-xl p-10 text-center">
                  <span className="text-xs text-slate-400 font-medium italic">
                    Please select both a class stream and an academic subject scope to open the gradebooks.
                  </span>
                </div>
              )}

              {/* SEPARATED SPLIT MIGRATION LAYOUT WORKBENCH */}
              {selectedStreamId && selectedScoreSubject && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                  
                  {/* =======================================================================
                      PANEL A: UNCOMMITTED INPUT ROSTER SHEET (Left Side)
                      ======================================================================= */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs xl:col-span-5 h-fit">
                    <div className="p-4 bg-amber-50/40 border-b border-amber-100">
                      <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        Pending Grade Sheet Inputs
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Students awaiting score initializes for this selected term module.</p>
                    </div>

                    <div className="p-4 space-y-4 max-h-[550px] overflow-y-auto">
                      {students.filter(st => st.stream_id === Number(selectedStreamId)).length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4 italic">No students registered to this class stream yet.</p>
                      ) : (
                        students
                          .filter(st => st.stream_id === Number(selectedStreamId))
                          // Exclude students who already have a committed database entry for this subject
                          .filter(st => !scores.some(sc => sc.student_id === st.id && sc.subject_id === Number(selectedScoreSubject)))
                          .map((student) => {
                            return (
                              <div key={student.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                                <div className="flex justify-between items-center border-b border-slate-200/60 pb-1">
                                  <span className="text-xs font-bold text-slate-700">{student.first_name} {student.last_name}</span>
                                  <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{student.admission_number}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-[10px] text-slate-500 font-bold block mb-0.5 uppercase">CAT 1</label>
                                    <input
                                      type="text"
                                      placeholder="0-100"
                                      value={editingCAT1[student.id] || ''}
                                      onChange={(e) => setEditingCAT1(prev => ({ ...prev, [student.id]: e.target.value }))}
                                      className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-semibold focus:outline-indigo-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-slate-500 font-bold block mb-0.5 uppercase">CAT 2</label>
                                    <input
                                      type="text"
                                      placeholder="0-100"
                                      value={editingCAT2[student.id] || ''}
                                      onChange={(e) => setEditingCAT2(prev => ({ ...prev, [student.id]: e.target.value }))}
                                      className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-semibold focus:outline-indigo-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-slate-500 font-bold block mb-0.5 uppercase">Exam</label>
                                    <input
                                      type="text"
                                      placeholder="0-100"
                                      value={editingFinalExam[student.id] || ''}
                                      onChange={(e) => setEditingFinalExam(prev => ({ ...prev, [student.id]: e.target.value }))}
                                      className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-semibold focus:outline-indigo-500"
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-end pt-1">
                                  <button
                                    onClick={() => handleSaveSingleScore(student.id)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-wide px-3 py-1 rounded transition cursor-pointer shadow-2xs"
                                  >
                                    Commit Record
                                  </button>
                                </div>
                              </div>
                            );
                          })
                      )}
                      {students.filter(st => st.stream_id === Number(selectedStreamId)).filter(st => !scores.some(sc => sc.subject_id === Number(selectedScoreSubject) && sc.student_id === st.id)).length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-4 italic">All student rows under this criteria filter have been committed.</p>
                      )}
                    </div>
                  </div>

                  {/* =======================================================================
                      PANEL B: ACTIVE DATABASE SCORES REGISTRY LEDGER (Right Side)
                      ======================================================================= */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs xl:col-span-7">
                    <div className="p-4 bg-indigo-50/40 border-b border-indigo-100">
                      <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wide">
                        Active Database Scores Registry Ledger
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Committed data blocks. Modify indices inline using existing validation rules or erase records completely.</p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-wider select-none">
                            <th className="px-4 py-2.5 w-[35%]">Student Detail</th>
                            <th className="px-2 py-2.5 text-center w-[12%]">CAT 1</th>
                            <th className="px-2 py-2.5 text-center w-[12%]">CAT 2</th>
                            <th className="px-2 py-2.5 text-center w-[12%]">Exam</th>
                            <th className="px-2 py-2.5 text-center w-[14%]">Weight Total</th>
                            <th className="px-4 py-2.5 text-right w-[15%]">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white text-xs">
                          {scores.filter(sc => sc.subject_id === Number(selectedScoreSubject) && students.some(st => st.id === sc.student_id && st.stream_id === Number(selectedStreamId))).length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400 italic">
                                No committed records found for this combination. Enter marks on the left to initialize tracking rows.
                              </td>
                            </tr>
                          ) : (
                            scores
                              .filter(sc => sc.subject_id === Number(selectedScoreSubject) && students.some(st => st.id === sc.student_id && st.stream_id === Number(selectedStreamId)))
                              .map((score) => {
                                const studentInfo = students.find(s => s.id === score.student_id);
                                const isEditingActive = selectedDetailedStudentId === score.student_id;

                                return (
                                  <tr key={score.id} className="hover:bg-slate-50/40 transition">
                                    {/* Student Profile Metadata block */}
                                    <td className="px-4 py-3">
                                      {studentInfo ? (
                                        <div>
                                          <div className="font-bold text-slate-800">{studentInfo.first_name} {studentInfo.last_name}</div>
                                          <div className="text-[10px] font-mono text-indigo-500 font-semibold">{studentInfo.admission_number}</div>
                                        </div>
                                      ) : (
                                        <span className="text-red-500 italic text-[11px]">Unknown Entity Record ({score.student_id})</span>
                                      )}
                                    </td>

                                    {/* CAT 1 Parameter Handle */}
                                    <td className="px-2 py-3 text-center">
                                      {isEditingActive ? (
                                        <input
                                          type="text"
                                          value={editingCAT1[score.student_id] !== undefined ? editingCAT1[score.student_id] : (score.CAT_1 !== null ? String(score.CAT_1) : '')}
                                          onChange={(e) => setEditingCAT1(prev => ({ ...prev, [score.student_id]: e.target.value }))}
                                          className="w-14 bg-slate-50 border border-slate-300 rounded text-center font-bold text-xs py-0.5 focus:bg-white focus:outline-indigo-500"
                                        />
                                      ) : (
                                        <span className="font-semibold text-slate-700">{score.CAT_1 !== null ? score.CAT_1 : '-'}</span>
                                      )}
                                    </td>

                                    {/* CAT 2 Parameter Handle */}
                                    <td className="px-2 py-3 text-center">
                                      {isEditingActive ? (
                                        <input
                                          type="text"
                                          value={editingCAT2[score.student_id] !== undefined ? editingCAT2[score.student_id] : (score.CAT_2 !== null ? String(score.CAT_2) : '')}
                                          onChange={(e) => setEditingCAT2(prev => ({ ...prev, [score.student_id]: e.target.value }))}
                                          className="w-14 bg-slate-50 border border-slate-300 rounded text-center font-bold text-xs py-0.5 focus:bg-white focus:outline-indigo-500"
                                        />
                                      ) : (
                                        <span className="font-semibold text-slate-700">{score.CAT_2 !== null ? score.CAT_2 : '-'}</span>
                                      )}
                                    </td>

                                    {/* Exam Parameter Handle */}
                                    <td className="px-2 py-3 text-center">
                                      {isEditingActive ? (
                                        <input
                                          type="text"
                                          value={editingFinalExam[score.student_id] !== undefined ? editingFinalExam[score.student_id] : (score.final_exam !== null ? String(score.final_exam) : '')}
                                          onChange={(e) => setEditingFinalExam(prev => ({ ...prev, [score.student_id]: e.target.value }))}
                                          className="w-14 bg-slate-50 border border-slate-300 rounded text-center font-bold text-xs py-0.5 focus:bg-white focus:outline-indigo-500"
                                        />
                                      ) : (
                                        <span className="font-semibold text-slate-700">{score.final_exam !== null ? score.final_exam : '-'}</span>
                                      )}
                                    </td>

                                    {/* Calculated Total Weighted summary */}
                                    <td className="px-2 py-3 text-center">
                                      {isEditingActive ? (
                                        <span className="text-[10px] text-amber-600 font-bold tracking-wide animate-pulse">Awaiting...</span>
                                      ) : (
                                        <span className="font-mono font-bold text-slate-900">{score.final_grade !== null ? score.final_grade : '-'}</span>
                                      )}
                                    </td>

                                      {/* FIXED CODE */}
                                      <td className="px-4 py-2">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${calculateGrade(score).color}`}>
                                          {calculateGrade(score).grade}
                                        </span>
                                      </td>
                                    {/* Ledger Operations Buttons */}
                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                      {isEditingActive ? (
                                        <div className="flex justify-end gap-1.5">
                                          <button
                                            onClick={() => handleSaveSingleScore(score.student_id)}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-2 py-1 rounded shadow-2xs cursor-pointer"
                                          >
                                            Save
                                          </button>
                                          <button
                                            onClick={() => {
                                              setSelectedDetailedStudentId(null);
                                              setEditingCAT1(prev => { const n = { ...prev }; delete n[score.student_id]; return n; });
                                              setEditingCAT2(prev => { const n = { ...prev }; delete n[score.student_id]; return n; });
                                              setEditingFinalExam(prev => { const n = { ...prev }; delete n[score.student_id]; return n; });
                                            }}
                                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold px-2 py-1 rounded cursor-pointer"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex justify-end gap-2.5">
                                          <button
                                            onClick={() => {
                                              setEditingCAT1(prev => ({ ...prev, [score.student_id]: score.CAT_1 !== null ? String(score.CAT_1) : '' }));
                                              setEditingCAT2(prev => ({ ...prev, [score.student_id]: score.CAT_2 !== null ? String(score.CAT_2) : '' }));
                                              setEditingFinalExam(prev => ({ ...prev, [score.student_id]: score.final_exam !== null ? String(score.final_exam) : '' }));
                                              setSelectedDetailedStudentId(score.student_id);
                                            }}
                                            className="text-amber-600 hover:text-amber-800 font-bold hover:underline cursor-pointer text-xs"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={async () => {
                                              if (!confirm("Are you sure you want to permanently delete this grade record?")) return;
                                              const { error } = await supabase.from('scores').delete().eq('id', score.id);
                                              if (error) alert(error.message);
                                              else fetchScores();
                                            }}
                                            className="text-red-600 hover:text-red-700 font-bold hover:underline cursor-pointer text-xs"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}
          {activeTab === 'rankings' && (
            <div className="space-y-10 animate-fadeIn">
              {streams.map((stream) => {
                const classRankings = getRankingsByStream(stream.id);
                
                return (
                  <div key={stream.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    {/* Stream Header */}
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                        {stream.name} - Performance Board
                      </h3>
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold">
                        {classRankings.length} Students
                      </span>
                    </div>

                    {/* Stream-Specific Table */}
                    <table className="w-full text-left">
                      <tbody className="divide-y divide-slate-100">
                        {classRankings.length > 0 ? (
                          classRankings.map((student, index) => (
                            <tr key={student.id} className="hover:bg-slate-50 transition text-xs">
                              <td className="px-6 py-3 font-black text-slate-400 w-16">#{index + 1}</td>
                              <td className="px-6 py-3 font-semibold text-slate-700">{student.first_name} {student.last_name}</td>
                              <td className="px-6 py-3 text-right font-bold text-indigo-600">{student.final_grade}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="px-6 py-8 text-center text-slate-400 italic">
                              No performance data available for this stream.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
          {/* The bridge is ALWAYS in the DOM, just hidden visually */}
          <div style={{ display: "none" }}>
            {printingStudent && (
              <ReportCard 
                ref={printRef} 
                student={printingStudent}  
                streams={streams}
                scores={scores
                              .filter((s) => s.student_id === printingStudent.id)
                              .map((s) => {
                                const subject = subjects.find((sub) => sub.id === s.subject_id);
                                return {
                                  ...s,
                                  subject_name: subject?.name || "Unknown",
                                  cat1: s.CAT_1 ?? 0, 
                                  cat2: s.CAT_2 ?? 0,
                                  exam: s.final_exam ?? 0,
                                  final_grade: s.final_grade ?? 0
                                };
                              })}
              />
            )}
          </div>
         </main>
      </div>
    </div>
  );
}