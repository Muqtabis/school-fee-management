const nodemailer = require("nodemailer");


// =====================================================
// EMAIL TRANSPORTER
// =====================================================

const transporter =
    nodemailer.createTransport({

        service: "gmail",

        auth: {

            user:
                process.env.ERP_EMAIL,

            pass:
                process.env.ERP_EMAIL_APP_PASSWORD

        }

    });


// =====================================================
// SEND PASSWORD RESET EMAIL
// =====================================================

async function sendPasswordResetEmail(
    email,
    resetUrl
) {

    await transporter.sendMail({

        from:
            `"The Age School ERP" <${process.env.ERP_EMAIL}>`,

        to:
            email,

        subject:
            "The Age School ERP - Password Reset",

        text: `
The Age School ERP

A password reset was requested for your administrator account.

Use the following link to reset your password:

${resetUrl}

This link will expire in 15 minutes.

If you did not request this password reset, you can safely ignore this email.
        `,

        html: `

            <div
                style="
                    font-family: Arial, sans-serif;
                    max-width: 600px;
                    margin: 40px auto;
                    padding: 30px;
                    border: 1px solid #ddd;
                    border-radius: 10px;
                "
            >

                <h2>
                    The Age School ERP
                </h2>

                <p>
                    A password reset was requested
                    for your administrator account.
                </p>

                <p>
                    Click the button below to
                    create a new password.
                </p>

                <p>

                    <a
                        href="${resetUrl}"
                        style="
                            display: inline-block;
                            padding: 12px 20px;
                            background: #1f4e79;
                            color: white;
                            text-decoration: none;
                            border-radius: 6px;
                        "
                    >
                        Reset Password
                    </a>

                </p>

                <p>
                    This link will expire in
                    <strong>15 minutes</strong>.
                </p>

                <p>
                    If you did not request this,
                    you can safely ignore this email.
                </p>

            </div>

        `

    });

}


module.exports =
    sendPasswordResetEmail;