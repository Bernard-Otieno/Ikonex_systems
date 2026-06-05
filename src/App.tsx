import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; // Connected to your Supabase credentials

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
  const [activeTab, setActiveTab] = useState<'streams' | 'students' | 'subjects' | 'scores'>('streams');
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
  const [selectedStreamId, setSelectedStreamId] = useState<string>('');

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
  const [selectedScoreSubject, setSelectedScoreSubject] = useState(''); // Filter: Selected Subject
  
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
    const { admission_number, first_name, last_name, stream_id } = studentForm;
    
    // Quick validation check
    if (!admission_number.trim() || !first_name.trim() || !last_name.trim() || !stream_id) {
      alert("Please populate all fields to save the student profile.");
      return;
    }

    if (isEditingStudent && studentForm.id) {
      // Operation: UPDATE an existing record
      const { error } = await supabase
        .from('students')
        .update({ 
          admission_number: admission_number.trim(), 
          first_name: first_name.trim(), 
          last_name: last_name.trim(), 
          stream_id: Number(stream_id) 
        })
        .eq('id', studentForm.id);
      
      if (error) alert(`Error updating: ${error.message}`);
    } else {
      // Operation: INSERT a new registration record
      const { error } = await supabase
        .from('students')
        .insert([{ 
          admission_number: admission_number.trim(), 
          first_name: first_name.trim(), 
          last_name: last_name.trim(), 
          stream_id: Number(stream_id) 
        }]);
      
      if (error) alert(`Error registering student: ${error.message}`);
    }

    // Reset form states and refresh directory list from database
    setStudentForm({ id: null, admission_number: '', first_name: '', last_name: '', stream_id: '' });
    setIsEditingStudent(false);
    fetchStudents();
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
  const calculateGrade = (mark: number) => {
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

      alert("Row scores evaluated and successfully committed to database!");
      fetchScores(); // Synchronize view state layout
    }
  };


  // Performs client-side array filtering based on the stream filtering dropdown choice
  const filteredStudents = selectedStreamFilter === 'all' 
    ? students 
    : students.filter(s => String(s.stream_id) === selectedStreamFilter);

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

const handleAddStudent = async () => {
    if (!newAdmissionNumber.trim() || !newFirstName.trim() || !newLastName.trim() || !selectedStreamId) {
      alert("Please fill out all student registration fields completely.");
      return;
    }

    const { error } = await supabase
      .from('students')
      .insert([{
        admission_number: newAdmissionNumber.trim().toUpperCase(),
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        stream_id: Number(selectedStreamId)
      }]);

    if (error) {
      alert(`Registration Error: ${error.message}`);
    } else {
      // Clear input form values upon successful creation
      setNewAdmissionNumber('');
      setNewFirstName('');
      setNewLastName('');
      fetchStudents(); // Sync local screen memory layout
    }
  };
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
                      
                      {/* Interactive Breadcrumb Control Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setSelectedDetailedStreamId(null)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
                            title="Back to grid view"
                          >
                            🔙 Back
                          </button>
                          <div>
                            <h2 className="text-xl font-bold text-slate-900">{targetStream.name}</h2>
                            <p className="text-xs text-slate-500">Detailed structural breakdown and current rosters</p>
                          </div>
                        </div>
                      </div>

                      {/* Stat Metrics Row Counters */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center gap-4 shadow-2xs">
                          <span className="text-2xl">👥</span>
                          <div>
                            <span className="block text-[11px] font-bold text-indigo-500 uppercase tracking-wide">Roster Size</span>
                            <span className="text-xl font-black text-slate-800">{roster.length} students</span>
                          </div>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-4 shadow-2xs">
                          <span className="text-2xl">📚</span>
                          <div>
                            <span className="block text-[11px] font-bold text-emerald-500 uppercase tracking-wide">Subject Scope</span>
                            <span className="text-xl font-black text-slate-800">{assignedLinks.length} active mappings</span>
                          </div>
                        </div>
                      </div>

                      {/* Sub-layout: Subject Scopes vs Student Roster list */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* Column A: Assigned Subject Frameworks */}
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden h-fit">
                          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-500 uppercase tracking-wider">
                            Mapped Subject Frameworks
                          </div>
                          {assignedLinks.length === 0 ? (
                            <p className="p-4 text-xs text-slate-400 italic">No assigned curriculum subjects.</p>
                          ) : (
                            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                              {assignedLinks.map(link => {
                                const sub = subjects.find(s => s.id === link.subject_id);
                                return sub ? (
                                  <div key={link.id} className="p-3 text-xs flex items-center justify-between">
                                    <span className="font-semibold text-slate-700">{sub.name}</span>
                                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold">{sub.code}</span>
                                  </div>
                                ) : null;
                              })}
                            </div>
                          )}
                        </div>

                        {/* Column B: Full Roster Rollcall Sheet View */}
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden lg:col-span-2">
                          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-500 uppercase tracking-wider">
                            Class Student Roster Rollcall
                          </div>
                          {roster.length === 0 ? (
                            <p className="p-6 text-sm text-slate-400 italic text-center">No students are currently allocated to this stream profile.</p>
                          ) : (
                            <div className="overflow-x-auto max-h-80 overflow-y-auto">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-400 font-bold uppercase">
                                    <th className="px-4 py-2.5">Admission Number</th>
                                    <th className="px-4 py-2.5">Full Registered Name</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {roster.map(student => (
                                    <tr key={student.id} className="hover:bg-slate-50/40">
                                      <td className="px-4 py-2.5 font-mono font-bold text-indigo-600">{student.admission_number}</td>
                                      <td className="px-4 py-2.5 font-medium text-slate-700">{student.first_name} {student.last_name}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                      </div>

                    </div>
                  );
                })()
              )}

            </div>
          )}



          {/* ================= STUDENTS MANAGEMENT & INDIVIDUAL PROFILE VIEWS ================= */}
          {activeTab === 'students' && (
            <div className="space-y-6">
              
              {!selectedDetailedStudentId ? (
                <>
                  {/* Standard Form Header Block for Student Entry */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">
                      Register New Student
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <input
                        type="text"
                        placeholder="Admission Number"
                        value={newAdmissionNumber}
                        onChange={(e) => setNewAdmissionNumber(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="text"
                        placeholder="First Name"
                        value={newFirstName}
                        onChange={(e) => setNewFirstName(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="text"
                        placeholder="Last Name"
                        value={newLastName}
                        onChange={(e) => setNewLastName(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <select
                        value={selectedStreamId}
                        onChange={(e) => setSelectedStreamId(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Select Stream --</option>
                        {streams.map(st => (
                          <option key={st.id} value={st.id}>{st.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-3 text-right">
                      <button
                        onClick={handleAddStudent}
                        className="bg-indigo-600 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-indigo-700 transition"
                      >
                        + Add Student
                      </button>
                    </div>
                  </div>

                  {/* Main Student Directory Table */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Registered Student Directory
                      </h3>
                    </div>

                    {students.length === 0 ? (
                      <p className="text-sm text-slate-500 italic text-center py-8">No students listed on the platform yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-slate-400 font-semibold text-xs uppercase">
                              <th className="px-6 py-3">Adm Number</th>
                              <th className="px-6 py-3">Full Name</th>
                              <th className="px-6 py-3">Assigned Class Stream</th>
                              <th className="px-6 py-3 text-right">Action</th>
                            </tr>
                          </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                    {students.map((student) => {
                      // Find a previously recorded database row matching this student + subject combination with exact Score typing
                      const existingRecord: Score | undefined = scores.find(
                        (sc: Score) => sc.student_id === student.id && sc.subject_id === Number(selectedScoreSubject)
                      );

                      // Form state selectors: prioritize active typing edits, fallback to existing saved numbers, or default to an empty string
                      const valCat1 = editingCAT1[student.id] !== undefined 
                        ? editingCAT1[student.id] 
                        : (existingRecord && existingRecord.CAT_1 !== null ? String(existingRecord.CAT_1) : '');

                      const valCat2 = editingCAT2[student.id] !== undefined 
                        ? editingCAT2[student.id] 
                        : (existingRecord && existingRecord.CAT_2 !== null ? String(existingRecord.CAT_2) : '');

                      const valExam = editingFinalExam[student.id] !== undefined 
                        ? editingFinalExam[student.id] 
                        : (existingRecord && existingRecord.final_exam !== null ? String(existingRecord.final_exam) : '');

                      // Parse input states to determine live evaluation metrics
                      const numCat1 = valCat1.trim() !== '' ? Number(valCat1) : null;
                      const numCat2 = valCat2.trim() !== '' ? Number(valCat2) : null;
                      const numExam = valExam.trim() !== '' ? Number(valExam) : null;

                      let liveFinalMarkPreview = "Pending";
                      let liveGradeIndicator = "";

                      // Compute live calculations if all 3 fields are currently populated by the teacher
                      if (numCat1 !== null && !isNaN(numCat1) && numCat2 !== null && !isNaN(numCat2) && numExam !== null && !isNaN(numExam)) {
                        const catAverage = (numCat1 + numCat2) / 2;
                        const weightedCat = (catAverage / 100) * 15;
                        const weightedExam = (numExam / 100) * 85;
                        const computedTotal = Math.round(weightedCat + weightedExam);
                        liveFinalMarkPreview = `${computedTotal}%`;
                        liveGradeIndicator = `Grade ${calculateGrade(computedTotal).grade}`;
                      } 
                      // Fallback to displaying saved values directly from database if fields are left untouched
                      else if (existingRecord && existingRecord.final_grade !== null) {
                        liveFinalMarkPreview = `${existingRecord.final_grade}%`;
                        liveGradeIndicator = `Grade ${calculateGrade(existingRecord.final_grade).grade}`;
                      }

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/50 transition border-b border-slate-100">
                          <td className="px-4 py-3 font-mono font-bold text-indigo-600">
                            {student.admission_number}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {student.first_name} {student.last_name}
                          </td>
                          
                          {/* CAT 1 Entry Input Column */}
                          <td className="px-3 py-2">
                            <div className="relative rounded-lg">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="0-100"
                                value={valCat1}
                                onChange={(e) => setEditingCAT1({ ...editingCAT1, [student.id]: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-2.5 pr-9 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                              />
                              <span className="absolute right-2 top-2 text-[10px] font-bold text-slate-400 select-none">/100</span>
                            </div>
                          </td>

                          {/* CAT 2 Entry Input Column */}
                          <td className="px-3 py-2">
                            <div className="relative rounded-lg">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="0-100"
                                value={valCat2}
                                onChange={(e) => setEditingCAT2({ ...editingCAT2, [student.id]: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-2.5 pr-9 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                              />
                              <span className="absolute right-2 top-2 text-[10px] font-bold text-slate-400 select-none">/100</span>
                            </div>
                          </td>

                          {/* Final Examination Entry Input Column */}
                          <td className="px-3 py-2">
                            <div className="relative rounded-lg">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="0-100"
                                value={valExam}
                                onChange={(e) => setEditingFinalExam({ ...editingFinalExam, [student.id]: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-2.5 pr-9 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                              />
                              <span className="absolute right-2 top-2 text-[10px] font-bold text-slate-400 select-none">/100</span>
                            </div>
                          </td>

                          {/* Live Weighted Calculation Preview Indicator column */}
                          <td className="px-4 py-3 text-center font-bold font-mono text-slate-800 bg-slate-50/40">
                            {liveFinalMarkPreview}
                          </td>

                          {/* Dynamic Letter Grade Badge indicator Column */}
                          <td className="px-4 py-3 text-center">
                            {liveGradeIndicator ? (
                              <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded-md font-extrabold tracking-wide uppercase font-mono">
                                {liveGradeIndicator}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic font-normal text-[11px] tracking-wide">Awaiting Marks</span>
                            )}
                          </td>

                          {/* Interactive Single Row Verification Action Trigger */}
                          <td className="px-4 py-2 text-right">
                            <button
                              onClick={() => handleSaveSingleScore(Number(student.id))}
                              className="bg-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-lg hover:bg-indigo-700 active:scale-98 transition duration-150"
                            >
                              Save Row
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                            </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* ================= SINGLE STUDENT PERFORMANCE RECORD DASHBOARD ================= */
                (() => {
                  const targetStudent = students.find(s => s.id === selectedDetailedStudentId);
                  if (!targetStudent) return <p className="text-sm text-red-500">Student session dropped.</p>;

                  const classStream = streams.find(st => st.id === targetStudent.stream_id);
                  const studentScores = scores.filter(sc => sc.student_id === targetStudent.id);

                  return (
                    <div className="space-y-6 animate-fadeIn">
                      
                      {/* Controls Breadcrumb Nav Bar */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setSelectedDetailedStudentId(null)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition text-xs font-bold"
                        >
                          🔙 Back to Directory
                        </button>
                      </div>

                      {/* Bio Meta Profile Card */}
                      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <span className="text-xs bg-indigo-50 font-mono text-indigo-700 font-bold px-2 py-0.5 rounded">
                            {targetStudent.admission_number}
                          </span>
                          <h2 className="text-2xl font-black text-slate-900 mt-1">
                            {targetStudent.first_name} {targetStudent.last_name}
                          </h2>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Allocated Class Unit: <strong className="text-slate-600 font-semibold">{classStream ? classStream.name : 'None'}</strong>
                          </p>
                        </div>
                        <div className="bg-slate-50 rounded-lg px-4 py-2 border border-slate-200 text-center w-full sm:w-auto">
                          <span className="text-xs font-bold text-slate-400 uppercase block tracking-wider">Subjects Taken</span>
                          <span className="text-xl font-black text-slate-800">{studentScores.length}</span>
                        </div>
                      </div>

                      {/* Performance Breakdown Table Grid Sheet */}
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-500 uppercase tracking-wider">
                          Academic Subject Performance Ledger
                        </div>

                        {studentScores.length === 0 ? (
                          <p className="p-8 text-sm text-slate-400 italic text-center">No examination scores saved for this student.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-400 font-bold uppercase">
                                  <th className="px-4 py-3">Subject Name</th>
                                  <th className="px-4 py-3 text-center">CAT 1 (/100)</th>
                                  <th className="px-4 py-3 text-center">CAT 2 (/100)</th>
                                  <th className="px-4 py-3 text-center">Final Exam (/100)</th>
                                  <th className="px-4 py-3 text-center bg-indigo-50/40 text-indigo-700">Calculated Final Mark</th>
                                  <th className="px-4 py-3 text-right">Letter Grade</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {studentScores.map(sc => {
                                  const sub = subjects.find(s => s.id === sc.subject_id);
                                  const gradeMetrics = sc.final_grade !== null ? calculateGrade(sc.final_grade) : null;

                                  return (
                                    <tr key={sc.id} className="hover:bg-slate-50/30">
                                      <td className="px-4 py-3 font-semibold text-slate-700">
                                        {sub ? `${sub.name} (${sub.code})` : `Unknown Subject ID: ${sc.subject_id}`}
                                      </td>
                                      <td className="px-4 py-3 text-center font-mono text-slate-600">{sc.CAT_1 !== null ? `${sc.CAT_1}` : '-'}</td>
                                      <td className="px-4 py-3 text-center font-mono text-slate-600">{sc.CAT_2 !== null ? `${sc.CAT_2}` : '-'}</td>
                                      <td className="px-4 py-3 text-center font-mono text-slate-600">{sc.final_exam !== null ? `${sc.final_exam}` : '-'}</td>
                                      <td className="px-4 py-3 text-center font-bold font-mono bg-indigo-50/20 text-slate-900">
                                        {sc.final_grade !== null ? `${sc.final_grade}%` : 'Pending'}
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                        {gradeMetrics ? (
                                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded lowercase tracking-wider first-letter:uppercase font-mono ${gradeMetrics.color}`}>
                                            Grade {gradeMetrics.grade}
                                          </span>
                                        ) : (
                                          <span className="text-slate-400 italic font-normal text-[10px]">No Grade</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })()
              )}

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
            <div className="space-y-6">
              
              {/* Context Selector Bar Block */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Target Assessment Class</label>
                  <select
                    value={selectedScoreStream}
                    onChange={(e) => {
                      setSelectedScoreStream(e.target.value);
                      setSelectedScoreSubject('');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose Class Target --</option>
                    {streams.map(st => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Subject Scope</label>
                  <select
                    value={selectedScoreSubject}
                    onChange={(e) => setSelectedScoreSubject(e.target.value)}
                    disabled={!selectedScoreStream}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    <option value="">-- Choose Subject Scope --</option>
                    {subjectMappings
                      .filter(m => String(m.stream_id) === selectedScoreStream)
                      .map(link => {
                        const sub = subjects.find(s => s.id === link.subject_id);
                        return sub ? <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option> : null;
                      })
                    }
                  </select>
                </div>
              </div>

              {/* Live Roster Sheet View */}
              {!selectedScoreStream || !selectedScoreSubject ? (
                <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center">
                  <span className="text-3xl block mb-2">📊</span>
                  <p className="text-sm font-medium text-slate-500">
                    Specify class stream and subject targets above to mount the gradebook terminal sheet.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  
                  {/* Dynamic Instructions Alert Header */}
                  <div className="px-6 py-4 bg-amber-50 border-b border-amber-200 flex items-start gap-3">
                    <span className="text-base mt-0.5">💡</span>
                    <div className="text-xs text-amber-800 leading-relaxed">
                      <strong className="font-semibold block mb-0.5">Grading Sheet Instructions:</strong>
                      Please input all student marks as a raw score out of 100. The system will automatically calculate the weights behind the scenes (Average CATs weighted to 15%, Final Exam weighted to 85%).
                    </div>
                  </div>
                  
                  {students.filter(s => String(s.stream_id) === selectedScoreStream).length === 0 ? (
                    <p className="text-sm text-slate-500 italic text-center py-12">
                      No student configurations available within this stream profile.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                            <th className="px-4 py-3">Adm Number</th>
                            <th className="px-4 py-3">Student Name</th>
                            {/* Clear Header Context Labels */}
                            <th className="px-4 py-3 w-32 text-slate-700 font-bold">CAT 1 <span className="block text-[10px] font-normal text-slate-400 font-sans tracking-normal normal-case">(Score out of 100)</span></th>
                            <th className="px-4 py-3 w-32 text-slate-700 font-bold">CAT 2 <span className="block text-[10px] font-normal text-slate-400 font-sans tracking-normal normal-case">(Score out of 100)</span></th>
                            <th className="px-4 py-3 w-32 text-slate-700 font-bold">Final Exam <span className="block text-[10px] font-normal text-slate-400 font-sans tracking-normal normal-case">(Score out of 100)</span></th>
                            <th className="px-4 py-3 text-center bg-indigo-50 text-indigo-700 font-bold">Weighted Total <span className="block text-[10px] font-bold text-indigo-500/70 font-sans tracking-normal normal-case">(Max 100%)</span></th>
                            <th className="px-4 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {students
                            .filter(s => String(s.stream_id) === selectedScoreStream)
                            .map((student) => {
                              const existingRecord = scores.find(
                                sc => sc.student_id === student.id && sc.subject_id === Number(selectedScoreSubject)
                              );
                              
                              const valCat1 = editingCAT1[student.id] !== undefined ? editingCAT1[student.id] : (existingRecord && existingRecord.CAT_1 !== null ? String(existingRecord.CAT_1) : '');
                              const valCat2 = editingCAT2[student.id] !== undefined ? editingCAT2[student.id] : (existingRecord && existingRecord.CAT_2 !== null ? String(existingRecord.CAT_2) : '');
                              const valExam = editingFinalExam[student.id] !== undefined ? editingFinalExam[student.id] : (existingRecord && existingRecord.final_exam !== null ? String(existingRecord.final_exam) : '');

                              const finalMark = existingRecord && existingRecord.final_grade !== null ? existingRecord.final_grade : null;
                              const dynamicGradeDetails = finalMark !== null ? calculateGrade(finalMark) : null;

                              return (
                                <tr key={student.id} className="hover:bg-slate-50/50 transition">
                                  <td className="px-4 py-3 font-mono text-xs text-indigo-600 font-semibold">
                                    {student.admission_number}
                                  </td>
                                  <td className="px-4 py-3 font-medium text-slate-700">
                                    {student.first_name} {student.last_name}
                                  </td>
                                  
                                  {/* CAT_1 Data Input Box */}
                                  <td className="px-4 py-3">
                                    <div className="relative flex items-center">
                                      <input 
                                        type="number" 
                                        placeholder="0-100"
                                        min="0"
                                        max="100"
                                        value={valCat1}
                                        onChange={(e) => setEditingCAT1({...editingCAT1, [student.id]: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-2 pr-7 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                      />
                                      <span className="absolute right-2 text-[10px] font-semibold text-slate-400">/100</span>
                                    </div>
                                  </td>

                                  {/* CAT_2 Data Input Box */}
                                  <td className="px-4 py-3">
                                    <div className="relative flex items-center">
                                      <input 
                                        type="number" 
                                        placeholder="0-100"
                                        min="0"
                                        max="100"
                                        value={valCat2}
                                        onChange={(e) => setEditingCAT2({...editingCAT2, [student.id]: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-2 pr-7 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                      />
                                      <span className="absolute right-2 text-[10px] font-semibold text-slate-400">/100</span>
                                    </div>
                                  </td>

                                  {/* final_exam Data Input Box */}
                                  <td className="px-4 py-3">
                                    <div className="relative flex items-center">
                                      <input 
                                        type="number" 
                                        placeholder="0-100"
                                        min="0"
                                        max="100"
                                        value={valExam}
                                        onChange={(e) => setEditingFinalExam({...editingFinalExam, [student.id]: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-2 pr-7 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                      />
                                      <span className="absolute right-2 text-[10px] font-semibold text-slate-400">/100</span>
                                    </div>
                                  </td>

                                  {/* Final Output Summary */}
                                  <td className="px-4 py-3 text-center bg-indigo-50/40 font-bold">
                                    {finalMark !== null && dynamicGradeDetails ? (
                                      <div className="flex flex-col items-center justify-center">
                                        <span className="text-sm font-mono text-slate-900">{finalMark}%</span>
                                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-sm uppercase tracking-wide shadow-2xs ${dynamicGradeDetails.color}`}>
                                          Grade {dynamicGradeDetails.grade}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-slate-400 italic font-normal">Pending Data</span>
                                    )}
                                  </td>

                                  {/* Save Button */}
                                  <td className="px-4 py-3 text-right">
                                    <button
                                      onClick={() => handleSaveSingleScore(student.id)}
                                      className="bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition"
                                    >
                                      Save Rows
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </main>
      </div>
    </div>
  );
}