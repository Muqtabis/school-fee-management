function SummaryTable({
    payments = [],
    onEdit,
    onDelete
}) {


    const formatDate = (date) => {

        if (!date) return "-";

        return new Date(
            date
        ).toLocaleDateString(
            "en-IN"
        );

    };


    const getModeClass = (mode) => {

        switch (
            mode?.toLowerCase()
        ) {

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


    const printReceipt = async (paymentId) => {

        try {

            const res =
                await fetch(
                    `http://localhost:5000/payments/receipt/${paymentId}`
                );


            if (!res.ok) {

                throw new Error(
                    "Receipt could not be loaded."
                );

            }


            const payment =
                await res.json();


            const receiptWindow =
                window.open(
                    "",
                    "_blank",
                    "width=800,height=900"
                );


            if (!receiptWindow) {

                alert(
                    "Please allow popups to print the receipt."
                );

                return;

            }


            receiptWindow.document.write(`

                <!DOCTYPE html>

                <html>

                <head>

                    <title>
                        Fee Receipt
                    </title>

                    <style>

                        body {

                            font-family:
                                Arial,
                                sans-serif;

                            padding: 40px;

                            color: #111;

                        }

                        .receipt {

                            max-width:
                                650px;

                            margin:
                                auto;

                            border:
                                1px solid #ddd;

                            padding:
                                30px;

                        }

                        .school {

                            text-align:
                                center;

                            border-bottom:
                                2px solid #111;

                            padding-bottom:
                                15px;

                            margin-bottom:
                                20px;

                        }

                        .school h1 {

                            margin:
                                0;

                        }

                        .school p {

                            margin:
                                5px 0;

                        }

                        .receipt-title {

                            text-align:
                                center;

                            margin:
                                20px 0;

                        }

                        .details {

                            width:
                                100%;

                            border-collapse:
                                collapse;

                        }

                        .details td {

                            padding:
                                10px;

                            border-bottom:
                                1px solid #eee;

                        }

                        .label {

                            font-weight:
                                bold;

                            width:
                                40%;

                        }

                        .amount {

                            font-size:
                                24px;

                            font-weight:
                                bold;

                        }

                        .footer {

                            margin-top:
                                30px;

                            text-align:
                                center;

                            font-size:
                                13px;

                        }

                        @media print {

                            body {

                                padding:
                                    0;

                            }

                            .receipt {

                                border:
                                    none;

                            }

                        }

                    </style>

                </head>


                <body>

                    <div class="receipt">

                        <div class="school">

                            <h1>
                                THE AGE SCHOOL
                            </h1>

                            <p>
                                School Fee Receipt
                            </p>

                        </div>


                        <h2
                            class="receipt-title"
                        >
                            PAYMENT RECEIPT
                        </h2>


                        <table
                            class="details"
                        >

                            <tr>

                                <td class="label">
                                    Receipt No.
                                </td>

                                <td>
                                    REC-${payment.id}
                                </td>

                            </tr>


                            <tr>

                                <td class="label">
                                    Date
                                </td>

                                <td>
                                    ${formatDate(
                                        payment.paymentDate
                                    )}
                                </td>

                            </tr>


                            <tr>

                                <td class="label">
                                    Student Name
                                </td>

                                <td>
                                    ${payment.studentName || "-"}
                                </td>

                            </tr>


                            <tr>

                                <td class="label">
                                    Roll Number
                                </td>

                                <td>
                                    ${payment.rollNumber || "-"}
                                </td>

                            </tr>


                            <tr>

                                <td class="label">
                                    Class
                                </td>

                                <td>
                                    ${payment.className || "-"}
                                </td>

                            </tr>


                            <tr>

                                <td class="label">
                                    Father Name
                                </td>

                                <td>
                                    ${payment.fatherName || "-"}
                                </td>

                            </tr>


                            <tr>

                                <td class="label">
                                    Payment Mode
                                </td>

                                <td>
                                    ${payment.paymentMode || "-"}
                                </td>

                            </tr>


                            <tr>

                                <td class="label">
                                    Remarks
                                </td>

                                <td>
                                    ${payment.remarks || "-"}
                                </td>

                            </tr>


                            <tr>

                                <td class="label">
                                    Amount Paid
                                </td>

                                <td class="amount">
                                    ₹ ${Number(
                                        payment.amount || 0
                                    ).toLocaleString("en-IN")}
                                </td>

                            </tr>

                        </table>


                        <div class="footer">

                            <p>
                                Thank you for your payment.
                            </p>

                            <p>
                                This is a computer-generated receipt.
                            </p>

                        </div>

                    </div>

                </body>

                </html>

            `);


            receiptWindow.document.close();


            receiptWindow.focus();


            setTimeout(() => {

                receiptWindow.print();

            }, 500);

        } catch (error) {

            console.error(error);

            alert(
                "Unable to generate receipt."
            );

        }

    };


    return (

        <div className="table-container">

            <table>

                <thead>

                    <tr>

                        <th>#</th>

                        <th>
                            Student
                        </th>

                        <th>
                            Roll No.
                        </th>

                        <th>
                            Class
                        </th>

                        <th>
                            Amount
                        </th>

                        <th>
                            Date
                        </th>

                        <th>
                            Mode
                        </th>

                        <th>
                            Remarks
                        </th>

                        <th>
                            Actions
                        </th>

                    </tr>

                </thead>


                <tbody>

                    {payments.length === 0 ? (

                        <tr>

                            <td
                                colSpan="9"
                                className="empty-row"
                            >

                                No payment records found.

                            </td>

                        </tr>

                    ) : (

                        payments.map(
                            (payment, index) => (

                                <tr
                                    key={
                                        payment.id
                                    }
                                >

                                    <td>
                                        {index + 1}
                                    </td>


                                    <td>
                                        {
                                            payment.studentName ||
                                            "-"
                                        }
                                    </td>


                                    <td>
                                        {
                                            payment.rollNumber ||
                                            "-"
                                        }
                                    </td>


                                    <td>
                                        {
                                            payment.className ||
                                            "-"
                                        }
                                    </td>


                                    <td>

                                        <strong>
                                            ₹{" "}
                                            {Number(
                                                payment.amount ||
                                                0
                                            ).toLocaleString(
                                                "en-IN"
                                            )}
                                        </strong>

                                    </td>


                                    <td>
                                        {
                                            formatDate(
                                                payment.paymentDate
                                            )
                                        }
                                    </td>


                                    <td>

                                        <span
                                            className={
                                                `payment-badge ${
                                                    getModeClass(
                                                        payment.paymentMode
                                                    )
                                                }`
                                            }
                                        >

                                            {
                                                payment.paymentMode
                                            }

                                        </span>

                                    </td>


                                    <td>
                                        {
                                            payment.remarks ||
                                            "-"
                                        }
                                    </td>


                                    <td>

                                        <div
                                            className="action-buttons"
                                        >

                                            <button
                                                className="receipt-btn"
                                                onClick={() =>
                                                    printReceipt(
                                                        payment.id
                                                    )
                                                }
                                            >

                                                Receipt

                                            </button>


                                            <button
                                                className="edit-btn"
                                                onClick={() =>
                                                    onEdit(
                                                        payment
                                                    )
                                                }
                                            >

                                                Edit

                                            </button>


                                            <button
                                                className="delete-btn"
                                                onClick={() =>
                                                    onDelete(
                                                        payment.id
                                                    )
                                                }
                                            >

                                                Delete

                                            </button>

                                        </div>

                                    </td>

                                </tr>

                            )
                        )

                    )}

                </tbody>

            </table>

        </div>

    );

}


export default SummaryTable;