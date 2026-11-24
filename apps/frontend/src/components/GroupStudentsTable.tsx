import './GroupStudentsTable.css';

/**
 * One student of a group as shown in the table (Figma "06 Grupa po imporcie": Lp., Login,
 * Status). The API does not return group members yet; see GroupDetailsPage.
 */
export interface GroupStudentRow {
  login: string;
  /** ISO timestamp of adding the student to the group. */
  assignedAt: string;
}

export function GroupStudentsTable({ students }: { students: readonly GroupStudentRow[] }) {
  return (
    <div className="students-table__wrap">
      <table className="students-table">
        <thead>
          <tr>
            <th scope="col" className="students-table__index">
              Lp.
            </th>
            <th scope="col">Login</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student, index) => (
            <tr key={student.login}>
              <td className="students-table__index">{index + 1}</td>
              <td className="students-table__login">{student.login}</td>
              <td className="students-table__status">Dodany {formatDate(student.assignedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const dateFormat = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** "18.11.2026" for an ISO timestamp; the raw value if it is not a valid date. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateFormat.format(date);
}
