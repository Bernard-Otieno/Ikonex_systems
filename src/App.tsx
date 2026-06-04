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

  // ==========================================
  // SECTION 2: INITIAL DATA LIFECYCLE
  // ==========================================
  useEffect(() => {
    fetchStreams();
    fetchStudents();
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
              <p className="text-sm text-slate-500 italic">Placeholder: Subject Framework configuration goes here.</p>
            </div>
          )}

          {/* ================= CLASS SCORES MODULE ================= */}

          {activeTab === 'scores' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 italic">Placeholder: Grading engine interface goes here.</p>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}