function SummaryTable({
    payments = [],
    onReverse
}) {


    // =====================================================
    // DATE
    // =====================================================

    const formatDate = (date) => {

        if (!date) {
            return "-";
        }

        return new Date(
            date
        ).toLocaleDateString(
            "en-IN"
        );

    };


    // =====================================================
    // PAYMENT MODE CLASS
    // =====================================================

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


    // =====================================================
    // PRINT TWO RECEIPTS
    // =====================================================

    const printReceipt = async (
        paymentId
    ) => {

        try {

            const token =
                localStorage.getItem(
                    "token"
                );


            const apiBaseUrl =
                import.meta.env.VITE_API_URL ||
                "http://localhost:5000";


            const response =
                await fetch(
                    `${apiBaseUrl}/payments/receipt/${paymentId}`,
                    {
                        headers: {

                            Authorization:
                                `Bearer ${token}`

                        }
                    }
                );


            if (!response.ok) {

                const errorData =
                    await response
                        .json()
                        .catch(
                            () =>
                                ({})
                        );


                throw new Error(
                    errorData.message ||
                    "Receipt could not be loaded."
                );

            }


            const payment =
                await response.json();


            const receiptWindow =
                window.open(
                    "",
                    "_blank",
                    "width=900,height=1100"
                );


            if (!receiptWindow) {

                alert(
                    "Please allow popups to print the receipt."
                );

                return;

            }


            // =================================================
            // SAFE VALUES
            // =================================================

            const receiptNumber =
                `REC-${payment.id}`;


            const studentName =
                payment.studentName ||
                "-";


            const rollNumber =
                payment.rollNumber ||
                "-";


            const className =
                payment.className ||
                "-";


            const fatherName =
                payment.fatherName ||
                "-";


            const academicYear =
                payment.academicYearName ||
                "-";


            const paymentDate =
                formatDate(
                    payment.paymentDate
                );


            const paymentMode =
                payment.paymentMode ||
                "-";


            const remarks =
                payment.remarks ||
                "-";


            const amount =
                Number(
                    payment.amount ||
                    0
                ).toLocaleString(
                    "en-IN",
                    {
                        minimumFractionDigits:
                            2,

                        maximumFractionDigits:
                            2
                    }
                );


            // =================================================
            // HTML
            // =================================================

            receiptWindow.document.write(`

                <!DOCTYPE html>

                <html>

                <head>

                    <meta charset="UTF-8">

                    <title>
                        Fee Receipt - ${receiptNumber}
                    </title>


                    <style>

                        * {
                            box-sizing: border-box;
                        }


                        @page {

                            size: A4 portrait;

                            margin: 10mm;

                        }


                        body {

                            margin: 0;

                            padding: 0;

                            background: #ffffff;

                            color: #111111;

                            font-family:
                                Arial,
                                Helvetica,
                                sans-serif;

                        }


                        .page {

                            width: 100%;

                            max-width:
                                190mm;

                            margin:
                                0 auto;

                        }


                        .receipt {

                            width: 100%;

                            min-height:
                                125mm;

                            border:
                                1.5px solid #111111;

                            padding:
                                9mm;

                            position:
                                relative;

                        }


                        .school-header {

                            text-align:
                                center;

                            border-bottom:
                                2px solid #111111;

                            padding-bottom:
                                5px;

                            margin-bottom:
                                6px;

                        }


                        .school-header h1 {

                            margin:
                                0;

                            font-size:
                                22px;

                            font-weight:
                                700;

                            letter-spacing:
                                0.5px;

                        }


                        .school-header p {

                            margin:
                                3px 0 0;

                            font-size:
                                12px;

                        }


                        .copy-title {

                            text-align:
                                center;

                            font-size:
                                14px;

                            font-weight:
                                700;

                            margin:
                                7px 0;

                            letter-spacing:
                                1px;

                        }


                        .receipt-top {

                            display:
                                flex;

                            justify-content:
                                space-between;

                            gap:
                                15px;

                            margin-bottom:
                                8px;

                        }


                        .receipt-number {

                            font-weight:
                                700;

                        }


                        .receipt-table {

                            width:
                                100%;

                            border-collapse:
                                collapse;

                            margin-top:
                                5px;

                        }


                        .receipt-table td {

                            padding:
                                5px 7px;

                            border:
                                1px solid #d1d5db;

                            font-size:
                                11px;

                            vertical-align:
                                top;

                        }


                        .receipt-table .label {

                            width:
                                25%;

                            font-weight:
                                700;

                            background:
                                #f3f4f6;

                        }


                        .amount-row td {

                            font-size:
                                15px;

                            font-weight:
                                700;

                        }


                        .amount-value {

                            font-size:
                                18px;

                        }


                        .payment-section {

                            margin-top:
                                7px;

                        }


                        .payment-section h4 {

                            margin:
                                0 0 4px;

                            font-size:
                                12px;

                        }


                        .payment-details {

                            display:
                                grid;

                            grid-template-columns:
                                1fr 1fr;

                            gap:
                                5px;

                        }


                        .payment-box {

                            border:
                                1px solid #d1d5db;

                            padding:
                                5px 7px;

                            font-size:
                                11px;

                        }


                        .payment-box strong {

                            display:
                                block;

                            margin-bottom:
                                2px;

                        }


                        .remarks {

                            margin-top:
                                6px;

                            border:
                                1px solid #d1d5db;

                            padding:
                                5px 7px;

                            min-height:
                                28px;

                            font-size:
                                10px;

                        }


                        .signatures {

                            display:
                                flex;

                            justify-content:
                                space-between;

                            gap:
                                25px;

                            margin-top:
                                17px;

                        }


                        .signature-box {

                            width:
                                42%;

                            text-align:
                                center;

                            font-size:
                                10px;

                        }


                        .signature-line {

                            border-top:
                                1px solid #111111;

                            margin-top:
                                20px;

                            padding-top:
                                3px;

                        }


                        .receipt-footer {

                            margin-top:
                                7px;

                            padding-top:
                                5px;

                            border-top:
                                1px solid #d1d5db;

                            text-align:
                                center;

                            font-size:
                                9px;

                            color:
                                #4b5563;

                        }


                        .cut-line {

                            display:
                                flex;

                            align-items:
                                center;

                            gap:
                                8px;

                            margin:
                                5mm 0;

                            color:
                                #555555;

                            font-size:
                                9px;

                        }


                        .cut-line::before,
                        .cut-line::after {

                            content:
                                "";

                            flex: 1;

                            border-top:
                                1px dashed #555555;

                        }


                        .cut-symbol {

                            font-size:
                                14px;

                        }


                        @media print {

                            body {

                                background:
                                    #ffffff;

                            }


                            .receipt {

                                page-break-inside:
                                    avoid;

                            }


                            .cut-line {

                                page-break-inside:
                                    avoid;

                            }

                        }

                    </style>

                </head>


                <body>


                    <div class="page">


                        <!-- =================================================
                             STUDENT COPY
                        ================================================= -->

                        <div class="receipt">

                            <div class="school-header">

                                <h1>
                                    THE AGE SCHOOL
                                </h1>

                                <p>
                                    School Fee Management System
                                </p>

                            </div>


                            <div class="copy-title">

                                STUDENT COPY

                            </div>


                            <div class="receipt-top">

                                <div>

                                    Receipt No:
                                    <span class="receipt-number">
                                        ${receiptNumber}
                                    </span>

                                </div>


                                <div>

                                    Date:
                                    <strong>
                                        ${paymentDate}
                                    </strong>

                                </div>

                            </div>


                            <table class="receipt-table">

                                <tr>

                                    <td class="label">
                                        Academic Year
                                    </td>

                                    <td>
                                        ${academicYear}
                                    </td>

                                </tr>


                                <tr>

                                    <td class="label">
                                        Student Name
                                    </td>

                                    <td>
                                        ${studentName}
                                    </td>

                                </tr>


                                <tr>

                                    <td class="label">
                                        Roll Number
                                    </td>

                                    <td>
                                        ${rollNumber}
                                    </td>

                                </tr>


                                <tr>

                                    <td class="label">
                                        Class
                                    </td>

                                    <td>
                                        ${className}
                                    </td>

                                </tr>


                                <tr>

                                    <td class="label">
                                        Father / Parent
                                    </td>

                                    <td>
                                        ${fatherName}
                                    </td>

                                </tr>


                                <tr class="amount-row">

                                    <td class="label">
                                        Amount Paid
                                    </td>

                                    <td>

                                        <span class="amount-value">
                                            ₹ ${amount}
                                        </span>

                                    </td>

                                </tr>

                            </table>


                            <div class="payment-section">

                                <h4>
                                    Payment Details
                                </h4>


                                <div class="payment-details">

                                    <div class="payment-box">

                                        <strong>
                                            Payment Mode
                                        </strong>

                                        ${paymentMode}

                                    </div>


                                    <div class="payment-box">

                                        <strong>
                                            Payment Status
                                        </strong>

                                        Completed

                                    </div>

                                </div>

                            </div>


                            <div class="remarks">

                                <strong>
                                    Remarks:
                                </strong>

                                ${remarks}

                            </div>


                            <div class="signatures">

                                <div class="signature-box">

                                    <div class="signature-line">

                                        Parent / Guardian Signature

                                    </div>

                                </div>


                                <div class="signature-box">

                                    <div class="signature-line">

                                        Authorized Signature

                                    </div>

                                </div>

                            </div>


                            <div class="receipt-footer">

                                Please retain this copy for your records.

                                This is a computer-generated fee receipt.

                            </div>

                        </div>


                        <!-- =================================================
                             CUT LINE
                        ================================================= -->

                        <div class="cut-line">

                            <span class="cut-symbol">
                                ✂
                            </span>

                            CUT HERE

                        </div>


                        <!-- =================================================
                             SCHOOL COPY
                        ================================================= -->

                        <div class="receipt">

                            <div class="school-header">

                                <h1>
                                    THE AGE SCHOOL
                                </h1>

                                <p>
                                    School Fee Management System
                                </p>

                            </div>


                            <div class="copy-title">

                                SCHOOL COPY

                            </div>


                            <div class="receipt-top">

                                <div>

                                    Receipt No:
                                    <span class="receipt-number">
                                        ${receiptNumber}
                                    </span>

                                </div>


                                <div>

                                    Date:
                                    <strong>
                                        ${paymentDate}
                                    </strong>

                                </div>

                            </div>


                            <table class="receipt-table">

                                <tr>

                                    <td class="label">
                                        Academic Year
                                    </td>

                                    <td>
                                        ${academicYear}
                                    </td>

                                </tr>


                                <tr>

                                    <td class="label">
                                        Student Name
                                    </td>

                                    <td>
                                        ${studentName}
                                    </td>

                                </tr>


                                <tr>

                                    <td class="label">
                                        Roll Number
                                    </td>

                                    <td>
                                        ${rollNumber}
                                    </td>

                                </tr>


                                <tr>

                                    <td class="label">
                                        Class
                                    </td>

                                    <td>
                                        ${className}
                                    </td>

                                </tr>


                                <tr>

                                    <td class="label">
                                        Father / Parent
                                    </td>

                                    <td>
                                        ${fatherName}
                                    </td>

                                </tr>


                                <tr class="amount-row">

                                    <td class="label">
                                        Amount Paid
                                    </td>

                                    <td>

                                        <span class="amount-value">
                                            ₹ ${amount}
                                        </span>

                                    </td>

                                </tr>

                            </table>


                            <div class="payment-section">

                                <h4>
                                    Payment Details
                                </h4>


                                <div class="payment-details">

                                    <div class="payment-box">

                                        <strong>
                                            Payment Mode
                                        </strong>

                                        ${paymentMode}

                                    </div>


                                    <div class="payment-box">

                                        <strong>
                                            Payment Status
                                        </strong>

                                        Completed

                                    </div>

                                </div>

                            </div>


                            <div class="remarks">

                                <strong>
                                    Remarks:
                                </strong>

                                ${remarks}

                            </div>


                            <div class="signatures">

                                <div class="signature-box">

                                    <div class="signature-line">

                                        Cashier / Receptionist

                                    </div>

                                </div>


                                <div class="signature-box">

                                    <div class="signature-line">

                                        Authorized Signature

                                    </div>

                                </div>

                            </div>


                            <div class="receipt-footer">

                                School copy — retain for school records.

                                This is a computer-generated fee receipt.

                            </div>

                        </div>

                    </div>


                </body>

                </html>

            `);


            receiptWindow.document.close();

            receiptWindow.focus();


            setTimeout(
                () => {

                    receiptWindow.print();

                },
                700
            );

        } catch (error) {

            console.error(
                "Receipt Error:",
                error
            );


            alert(
                error.message ||
                "Unable to generate receipt."
            );

        }

    };


    return (

        <div
            className="table-container"
        >

            <table>

                <thead>

                    <tr>

                        <th>
                            #
                        </th>

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
                            Academic Year
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
                            Status
                        </th>

                        <th>
                            Actions
                        </th>

                    </tr>

                </thead>


                <tbody>

                    {
                        payments.length ===
                        0 ? (

                            <tr>

                                <td
                                    colSpan="10"
                                    className="empty-row"
                                >

                                    No payment records found.

                                </td>

                            </tr>

                        ) : (

                            payments.map(
                                (
                                    payment,
                                    index
                                ) => (

                                    <tr
                                        key={
                                            payment.id
                                        }
                                        style={
                                            payment.status ===
                                            "reversed"
                                                ? {
                                                    opacity:
                                                        0.6
                                                }
                                                : {}
                                        }
                                    >

                                        <td>
                                            {
                                                index + 1
                                            }
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
                                            {
                                                payment.academicYearName ||
                                                "-"
                                            }
                                        </td>


                                        <td>

                                            <strong>

                                                ₹{" "}

                                                {
                                                    Number(
                                                        payment.amount ||
                                                        0
                                                    ).toLocaleString(
                                                        "en-IN"
                                                    )
                                                }

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
                                                payment.status ===
                                                "reversed" ? (

                                                    <span
                                                        className="payment-badge mode-default"
                                                    >
                                                        Reversed
                                                    </span>

                                                ) : (

                                                    <span
                                                        className="payment-badge mode-upi"
                                                    >
                                                        Completed
                                                    </span>

                                                )
                                            }

                                        </td>


                                        <td>

                                            <div
                                                className="action-buttons"
                                            >

                                                {
                                                    payment.status !==
                                                    "reversed" && (

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

                                                    )
                                                }


                                                {
                                                    payment.status !==
                                                    "reversed" && (

                                                        <button
                                                            className="delete-btn"
                                                            onClick={() =>
                                                                onReverse(
                                                                    payment
                                                                )
                                                            }
                                                        >

                                                            Reverse

                                                        </button>

                                                    )
                                                }

                                            </div>

                                        </td>

                                    </tr>

                                )
                            )

                        )
                    }

                </tbody>

            </table>

        </div>

    );

}


export default SummaryTable;