const express = require("express");
const cors = require("cors");

require("./db");

const app = express();

app.use(cors());

app.use(express.json());

app.use("/auth", require("./routes/auth"));

app.use("/students", require("./routes/students"));

app.use("/payments", require("./routes/payments"));

app.use("/notifications", require("./routes/notifications"));


app.get("/", (req, res) => {

    res.json({
        status: "THE AGE SCHOOL API Running"
    });

});


app.listen(5000, () => {

    console.log(
        "Server Running on http://localhost:5000"
    );

});