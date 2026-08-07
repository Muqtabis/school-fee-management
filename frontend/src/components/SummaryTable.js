function SummaryTable({
  payments = [],
  onEdit,
  onDelete
}) {

  const formatDate = (date) => {

    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-IN");

  };

  const getModeClass = (mode) => {

    switch (mode?.toLowerCase()) {

      case "cash":
        return "mode-cash";

      case "upi":
        return "mode-upi";

      case "card":
        return "mode-card";

      case "bank transfer":
        return "mode-bank";

      default:
        return "mode-default";

    }

  };

  return (

    <div className="table-container">

      <table>

        <thead>

          <tr>

            <th>#</th>

            <th>Student</th>

            <th>Amount</th>

            <th>Date</th>

            <th>Mode</th>

            <th>Remarks</th>

            <th>Actions</th>

          </tr>

        </thead>

        <tbody>

          {

            payments.length === 0 ?

              (

                <tr>

                  <td
                    colSpan="7"
                    className="empty-row"
                  >

                    No payment records found.

                  </td>

                </tr>

              )

              :

              payments.map((payment, index) => (

                <tr key={payment.id}>

                  <td>{index + 1}</td>

                  <td>

                    {payment.studentName}

                  </td>

                  <td>

                    ₹ {Number(payment.amount).toLocaleString()}

                  </td>

                  <td>

                    {formatDate(payment.paymentDate)}

                  </td>

                  <td>

                    <span
                      className={`payment-badge ${getModeClass(payment.paymentMode)}`}
                    >

                      {payment.paymentMode}

                    </span>

                  </td>

                  <td>

                    {payment.remarks || "-"}

                  </td>

                  <td>

                    <div className="action-buttons">

                      <button

                        className="edit-btn"

                        onClick={() => onEdit(payment)}

                      >

                        Edit

                      </button>

                      <button

                        className="delete-btn"

                        onClick={() => onDelete(payment.id)}

                      >

                        Delete

                      </button>

                    </div>

                  </td>

                </tr>

              ))

          }

        </tbody>

      </table>

    </div>

  );

}

export default SummaryTable;