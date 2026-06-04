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
  const [editingScores, setEditingScores] = useState<{ [studentId: number]: string }>({}); // Holds typed inputs temporarily before save
  // Tracks the chosen CA type (e.g., CAT 1, Quiz 1, Final Exam)
  const [selectedAssessmentType, setSelectedAssessmentType] = useState('CAT 1');
  // --- STATE REGISTERS FOR THE RECONFIGURED ASSESSMENT COLUMNS ---
  const [editingCAT1, setEditingCAT1] = useState<{ [studentId: number]: string }>({});
  const [editingCAT2, setEditingCAT2] = useState<{ [studentId: number]: string }>({});
  const [editingFinalExam, setEditingFinalExam] = useState<{ [studentId: number]: string }>({});

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
      alert("Please choose an active subject framework.");
      return;
    }

    // Capture raw values from frontend input text fields
    const rawCat1 = editingCAT1[studentId];
    const rawCat2 = editingCAT2[studentId];
    const rawExam = editingFinalExam[studentId];

    // Find if a record exists for this Student + Subject combo
    const existingEntry = scores.find(
      s => s.student_id === studentId && s.subject_id === Number(selectedScoreSubject)
    );

    // Fallback gracefully to existing data values if input cell is untouched
    const cat1Value = rawCat1 !== undefined && rawCat1.trim() !== '' ? Number(rawCat1) : (existingEntry ? existingEntry.CAT_1 : null);
    const cat2Value = rawCat2 !== undefined && rawCat2.trim() !== '' ? Number(rawCat2) : (existingEntry ? existingEntry.CAT_2 : null);
    const examValue = rawExam !== undefined && rawExam.trim() !== '' ? Number(rawExam) : (existingEntry ? existingEntry.final_exam : null);

    // Guard Check: Ensure marks fall within realistic bounds
    if ((cat1Value !== null && (cat1Value < 0 || cat1Value > 100)) ||
        (cat2Value !== null && (cat2Value < 0 || cat2Value > 100)) ||
        (examValue !== null && (examValue < 0 || examValue > 100))) {
      alert("Please ensure score properties fall strictly between 0 and 100 marks.");
      return;
    }

    // Engine Formulation Logic to determine the numerical final mark total out of 100%
    let finalNumericTotal: number | null = null;
    if (cat1Value !== null || cat2Value !== null || examValue !== null) {
      const cat1Safe = cat1Value ?? 0;
      const cat2Safe = cat2Value ?? 0;
      const activeCatCount = (cat1Value !== null ? 1 : 0) + (cat2Value !== null ? 1 : 0);
      const catAverageOutOf100 = activeCatCount > 0 ? (cat1Safe + cat2Safe) / activeCatCount : 0;
      const catComponent = (catAverageOutOf100 / 100) * 15; // Max 15 marks

      const examSafe = examValue ?? 0;
      const examComponent = (examSafe / 100) * 85; // Max 85 marks

      finalNumericTotal = Math.round(catComponent + examComponent);
    }

    // Payload configuration utilizing the updated numeric column system
    const payload = {
      student_id: studentId,
      subject_id: Number(selectedScoreSubject),
      CAT_1: cat1Value,
      CAT_2: cat2Value,
      final_exam: examValue,
      final_grade: finalNumericTotal // Numeric value saved directly for student ranking operations
    };

    if (existingEntry) {
      // Operation: UPDATE operation on matching record row
      const { error } = await supabase
        .from('scores')
        .update({
          CAT_1: cat1Value,
          CAT_2: cat2Value,
          final_exam: examValue,
          final_grade: finalNumericTotal
        })
        .eq('id', existingEntry.id);

      if (error) alert(`Update Error: ${error.message}`);
    } else {
      // Operation: INSERT completely new score matrix row
      const { error } = await supabase
        .from('scores')
        .insert([payload]);

      if (error) alert(`Insert Error: ${error.message}`);
    }

    fetchScores(); // Sync local state memory layout
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



          {/* ================= CLASS STREAMS MODULE ================= */}

          {activeTab === 'streams' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              {/* Column 1: Creation Input Form */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
                  Establish New Stream
                </h3>
                <form onSubmit={handleAddStream} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Stream Name
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g., Form 1A"
                      value={newStreamName}
                      onChange={(e) => setNewStreamName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="w-full bg-indigo-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm"
                  >
                    + Add Stream
                  </button>
                </form>
              </div>

              {/* Column 2 & 3: Master Directory Grid Table */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm col-span-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
                  Configured Academy Streams ({streams.length})
                </h3>
                {streams.length === 0 ? (
                  <p className="text-sm text-slate-500 italic py-4">
                    No stream records found. Create one using the side panel form.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                    {streams.map((stream) => (
                      <div key={stream.id} className="py-3 flex justify-between items-center text-sm">
                        <span className="font-semibold text-slate-700">{stream.name}</span>
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded font-mono">
                          STREAM_ID: #{stream.id}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}



          {/* ================= CLASS STUDENTS MODULE ================= */}

          {activeTab === 'students' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">


              {/* ================= STUDENT MANAGEMENT MODULE ================= */}
          {activeTab === 'students' && (
            <div className="space-y-8">
              
              {/* Form Block: Registry Inputs */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
                  {isEditingStudent ? "Modify Student Profile Record" : "Register New Student Instance"}
                </h3>
                <form onSubmit={handleSaveStudent} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Admission Number</label>
                    <input 
                      type="text" 
                      placeholder="e.g., ADM-2026-001"
                      value={studentForm.admission_number}
                      onChange={(e) => setStudentForm({...studentForm, admission_number: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">First Name</label>
                    <input 
                      type="text" 
                      placeholder="Jane"
                      value={studentForm.first_name}
                      onChange={(e) => setStudentForm({...studentForm, first_name: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Last Name</label>
                    <input 
                      type="text" 
                      placeholder="Smith"
                      value={studentForm.last_name}
                      onChange={(e) => setStudentForm({...studentForm, last_name: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Assigned Stream</label>
                    <select
                      value={studentForm.stream_id}
                      onChange={(e) => setStudentForm({...studentForm, stream_id: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Choose Class Target --</option>
                      {streams.map(st => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="md:col-span-4 flex justify-end space-x-2">
                    {isEditingStudent && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setIsEditingStudent(false);
                          setStudentForm({ id: null, admission_number: '', first_name: '', last_name: '', stream_id: '' });
                        }}
                        className="bg-slate-200 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-300 transition"
                      >
                        Cancel Edit
                      </button>
                    )}
                    <button type="submit" className="bg-indigo-600 text-white text-sm font-medium px-6 py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm">
                      {isEditingStudent ? "Apply Record Update" : "Register Student"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Data Table Block: Directory & Live Filtering */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Institutional Directory Registry</h3>
                  <div className="flex items-center space-x-2">
                    <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">Filter Stream View:</label>
                    <select
                      value={selectedStreamFilter}
                      onChange={(e) => setSelectedStreamFilter(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="all">Show All Registered Students</option>
                      {streams.map(st => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {filteredStudents.length === 0 ? (
                  <p className="text-sm text-slate-500 italic text-center py-8">No student profiles match the filter criteria.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                          <th className="pb-3">Adm Number</th>
                          <th className="pb-3">Full Name</th>
                          <th className="pb-3">Assigned Class Stream</th>
                          <th className="pb-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredStudents.map((student) => {
                          const matchingStream = streams.find(str => str.id === student.stream_id);
                          return (
                            <tr key={student.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-3 font-mono text-xs text-indigo-600 font-semibold">{student.admission_number}</td>
                              <td className="py-3 font-medium text-slate-700">{student.first_name} {student.last_name}</td>
                              <td className="py-3">
                                <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full font-medium">
                                  {matchingStream ? matchingStream.name : 'Unknown/Unassigned'}
                                </span>
                              </td>
                              <td className="py-3 text-right space-x-3">
                                <button 
                                  onClick={() => handleEditStudentClick(student)}
                                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                                >
                                  Modify
                                </button>
                                <button 
                                  onClick={() => handleDeleteStudent(student.id)}
                                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition"
                                >
                                  Remove
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

            </div>
          )}
            </div>
          )}



          {/* ================= CLASS SUBJECTS MODULE ================= */}

          {activeTab === 'subjects' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              
          {activeTab === 'subjects' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Left Wing Panel: Global Subject Inventory Creation */}
              <div className="space-y-8">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
                    Create Global Subject Definition
                  </h3>
                  {/* Updated Creation Input Form */}
                  <form onSubmit={handleAddSubject} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Subject Name
                      </label>
                      <input 
                        type="text" 
                        placeholder="e.g., Mathematics"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* New Input Field for Subject Code */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Subject Code
                      </label>
                      <input 
                        type="text" 
                        placeholder="e.g., MATH"
                        value={newSubjectCode}
                        onChange={(e) => setNewSubjectCode(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <button 
                      type="submit" 
                      className="w-full bg-indigo-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm"
                    >
                      + Save to Inventory Library
                    </button>
                  </form>
                </div>

                {/* Sub-Panel: Subject Catalog View */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Active Subject Catalog Inventory ({subjects.length})
                  </h3>
                  {subjects.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No subject catalog rows found.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 max-h-[220px] overflow-y-auto p-1">
                      {subjects.map((sub) => (
                        <span key={sub.id} className="bg-slate-100 text-slate-800 text-xs px-3 py-1.5 rounded-lg border border-slate-200 font-medium shadow-2xs">
                          📚 {sub.name} <span className="text-slate-400 font-mono text-[10px]">#{sub.id}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Wing Panel: Stream Structural Mapping Assignation */}
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
                    Map Subject to Target Class Stream
                  </h3>
                  <form onSubmit={handleAssignSubjectToStream} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Target Class Stream
                      </label>
                      <select
                        value={selectedMappingStream}
                        onChange={(e) => setSelectedMappingStream(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Select Class --</option>
                        {streams.map((st) => (
                          <option key={st.id} value={st.id}>{st.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Subject Resource
                      </label>
                      <select
                        value={selectedMappingSubject}
                        onChange={(e) => setSelectedMappingSubject(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Choose Subject --</option>
                        {subjects.map((sub) => (
                          <option key={sub.id} value={sub.id}>{sub.name}</option>
                        ))}
                      </select>
                    </div>

                    <button 
                      type="submit" 
                      className="w-full bg-emerald-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm"
                    >
                      ⛓️ Link Subject Configuration
                    </button>
                  </form>
                </div>

                {/* Grid Framework: View Curated Configurations */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
                    Active Stream Curriculum Configurations
                  </h3>
                  {streams.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">Configure Class Streams first to see structural mappings.</p>
                  ) : (
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                      {streams.map((stream) => {
                        // Find all mapping records attached to this exact stream row
                        const activeLinks = subjectMappings.filter(m => m.stream_id === stream.id);
                        
                        return (
                          <div key={stream.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-2">
                            <span className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-1 uppercase tracking-wide">
                              🏫 {stream.name} Curriculum Allocation
                            </span>
                            {activeLinks.length === 0 ? (
                              <span className="text-xs text-slate-400 italic">No assigned subjects linked yet.</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {activeLinks.map((link) => {
                                  // Locate the matched clear textual string from the master list
                                  const matchingSubjectName = subjects.find(s => s.id === link.subject_id)?.name || `ID: ${link.subject_id}`;
                                  return (
                                    <span key={link.id} className="bg-white border border-slate-200 text-slate-700 text-[11px] px-2 py-0.5 rounded-md font-medium">
                                      {matchingSubjectName}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
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