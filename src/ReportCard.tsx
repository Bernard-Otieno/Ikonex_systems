import { forwardRef } from 'react';
interface ReportCardProps {
  student: any;
  scores: any[];
  streams: any[];
}
// Create a component that matches your interface
export const ReportCard = forwardRef<HTMLDivElement, ReportCardProps>(
  ({ student, scores, streams }, ref) => {
    const studentStream = streams.find((s: any) => s.id === student.stream_id)?.name || "N/A";
  return (
    <div ref={ref} className="p-8 bg-white border border-slate-200">
      <h1 className="text-2xl font-bold">Academic Report Card</h1>
      <p><strong>Name:</strong> {student.first_name} {student.last_name}</p>
      <p><strong>Stream:</strong> {studentStream} | <strong>Adm:</strong> {student.admission_number}</p>

      <table className="w-full mt-6 border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className="border p-2">Subject</th>
            <th className="border p-2">CAT 1</th>
            <th className="border p-2">CAT 2</th>
            <th className="border p-2">Exam</th>
            <th className="border p-2">Final Grade</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((s: any) => (
            <tr key={s.id}>
              <td className="border p-2">{s.subject_name}</td>
              <td className="border p-2">{s.cat1 ?? '-'}</td>
              <td className="border p-2">{s.cat2 ?? '-'}</td>
              <td className="border p-2">{s.exam ?? '-'}</td>
              <td className="border p-2 font-bold">{s.final_grade}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});