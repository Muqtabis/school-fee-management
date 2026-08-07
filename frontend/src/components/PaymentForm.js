import { useEffect, useState } from "react";
import api from "../services/api";

function PaymentForm({ payment, onClose }) {
  const [students, setStudents] = useState([]);

  const [formData, setFormData] = useState({
    studentId: "",
    paymentDate: new Date().toISOString().split("T")[0],
    amount: "",
    paymentMode: "Cash",
    remarks: ""
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStudents();

    if (payment) {
      setFormData({
        studentId: payment.studentId,
        paymentDate: payment.paymentDate,
        amount: payment.amount,
        paymentMode: payment.paymentMode,
        remarks: payment.remarks || ""
      });
    }
  }, [payment]);

  const fetchStudents = async () => {
    try {
      const res = await api.get("/students");
      setStudents(res.data);
    } catch (error) {
      console.log(error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      if (payment) {
        await api.put(`/payments/${payment.id}`, formData);
      } else {
        await api.post("/payments", formData);
      }

      onClose();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          "Unable to save payment."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">

      <div className="payment-modal">

        <div className="modal-header">

          <h2>

            {payment ? "Update Payment" : "Collect Fee"}

          </h2>

          <button
            className="close-btn"
            onClick={onClose}
          >
            ✕
          </button>

        </div>

        <form
          className="payment-form"
          onSubmit={handleSubmit}
        >

          <div className="form-group">

            <label>Student</label>

            <select
              name="studentId"
              value={formData.studentId}
              onChange={handleChange}
              required
            >

              <option value="">

                Select Student

              </option>

              {students.map((student) => (

                <option
                  key={student.id}
                  value={student.id}
                >

                  {student.studentName} ({student.className})

                </option>

              ))}

            </select>

          </div>

          <div className="form-group">

            <label>Payment Date</label>

            <input
              type="date"
              name="paymentDate"
              value={formData.paymentDate}
              onChange={handleChange}
              required
            />

          </div>

          <div className="form-group">

            <label>Amount</label>

            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              required
            />

          </div>

          <div className="form-group">

            <label>Payment Mode</label>

            <select
              name="paymentMode"
              value={formData.paymentMode}
              onChange={handleChange}
            >

              <option>Cash</option>

              <option>UPI</option>

              <option>Card</option>

              <option>Bank Transfer</option>

            </select>

          </div>

          <div
            className="form-group"
            style={{ gridColumn: "1 / 3" }}
          >

            <label>Remarks</label>

            <textarea
              rows="4"
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
            />

          </div>

          <div className="modal-actions">

            <button
              type="button"
              className="cancel-btn"
              onClick={onClose}
            >

              Cancel

            </button>

            <button
              type="submit"
              className="save-btn"
            >

              {loading
                ? "Saving..."
                : payment
                ? "Update Payment"
                : "Collect Fee"}

            </button>

          </div>

        </form>

      </div>

    </div>
  );
}

export default PaymentForm;