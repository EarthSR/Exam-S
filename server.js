const express = require('express')
const mysql = require('mysql2')
const app = express()
const port = 3000
const bcrypt = require('bcrypt'); // Make sure to include bcrypt
const jwt = require('jsonwebtoken');
var secureKey = 'asdkasjsdijas122131ws';
const db = mysql.createConnection(
    {
        host: "localhost",
        user: "root",
        password: "1234",
        database: "shopdee"
    }
)
db.connect()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.post('/product', function (req, res) {
    const { productName, productDetail, price, cost, quantity } =
        req.body;
    let sql = "INSERT INTO product (productName, productDetail, price, cost, quantity)"
    sql += "VALUES('" + productName + "','" + productDetail + "', "
    sql += price + "," + cost + "," + quantity + ")"
    db.query(sql,
        function (err, result) {
            if (err) throw err;
            res.send({ 'message': 'บันทึกข้อมูลส ำเร็จ', 'status': true });
        }
    )
})

// ฟังก์ชั่นการเช็คtoken
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (token == null) return res.status(401).send({ message: 'จำเป็นต้องมีโทเค็น', status: false });

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) return res.status(403).send({ message: 'โทเค็นไม่ถูกต้อง', status: false });
        req.user = user;
        next();
    });
}
// new product update
app.post('/productnew', authenticateToken, function (req, res) { //เช็คtokenของผู้ทำป้องการคนที่รู้ api part 
    const { productName, productDetail, price, cost, quantity } = req.body;

    // ป้องกันการใส่ค่าว่าง
    if (!productName || !productDetail || isNaN(price) || isNaN(cost) || isNaN(quantity)) {
        return res.status(400).send({
            message: "Invalid input data",
            status: false
        });
    }

    //ป้องกันการ SQL injection
    const sql = "INSERT INTO product (productName, productDetail, price, cost, quantity) VALUES (?, ?, ?, ?, ?)";

    db.query(sql, [productName, productDetail, price, cost, quantity], function (err, result) {
        if (err) {
            console.error(err);
            return res.status(500).send({
                message: "An error occurred while saving the product.",
                status: false
            });
        }
        res.send({ message: 'Product saved successfully', status: true });
    });
});



app.get('/product/:id',
    function (req, res) {
        const productID = req.params.id;
        let sql = "SELECT * FROM product WHERE "
        sql += "productID=" + productID;
        db.query(sql,
            function (err, result) {
                if (err) throw err;
                res.send(result);
            }
        );
    }
);

//productid new version
app.get('/product/:id', function (req, res) {
    const productID = req.params.id;

    //ป้องกันการ SQL injection
    let sql = "SELECT * FROM product WHERE productID = ?";

    db.query(sql, [productID], function (err, result) {
        if (err) {
            console.error(err);
            return res.status(500).send({
                message: "An error occurred while fetching the product.",
                status: false
            });
        }
        res.send(result);
    });
});



app.post('/login', function (req, res) {
    const { username, password } = req.body
    let sql = "SELECT * FROM customer WHERE "
    sql += "username='" + username + "'";
    sql += " AND password = '" + password + "' AND isActive = 1";
    db.query(sql, [username, password], function (err, result) {
        console.log(db.format(sql))
        if (err) throw err
        if (result.length > 0) {
            let customer = result[0]
            customer['message'] = "เข้ำสู่ระบบส ำเร็จ"
            customer['status'] = true
            res.send(customer)
        } else {
            res.send({
                "message": "กรุณำระบุรหัสผ่ำนใหม่อีกครั้ง",
                "status": false
            })
        }
    })
})

//login new version
app.post('/loginnew', function (req, res) {
    const { username, password } = req.body;

    // ป้องกันการใส่ค่าว่าง
    if (!username || !password) {
        return res.status(400).send({
            message: "จำเป็นต้องมีชื่อผู้ใช้และรหัสผ่าน",
            status: false
        });
    }

    const sql = "SELECT * FROM customer WHERE username = ? AND isActive = 1";

    db.query(sql, [username], function (err, result) {
        if (err) {
            console.error('Error logging in:', err);
            return res.status(500).send({
                message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ',
                status: false
            });
        }

        if (result.length > 0) {
            const user = result[0];
            // ช่วยเพิ่มความปลอดภัยด้วยการเข้ารหัสดัวย bcrypt แต่ต้องมีการเข้ารหัสตั้งแต่ตอนลงทะเบียน
            // bcrypt.compare(password, user.password, function (err, match) {
            //     if (err) {
            //         console.error('Error comparing passwords:', err);
            //         return res.status(500).send({
            //             message: "เกิดข้อผิดพลาดขณะเปรียบเทียบรหัสผ่าน",
            //             status: false
            //         });
            //     }

            //     if (match) {
            //         user.message = "เข้าสู่ระบบสำเร็จ";
            //         user.status = true;
            //         res.send(user);
            //     } else {
            //         res.send({
            //             message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
            //             status: false
            //         });
            //     }
            // });

            // ตรวจสอบว่าบัญชีถูกล็อคอยู่หรือไม่
            if (user.lockoutTime && new Date(user.lockoutTime) > new Date()) {
                return res.status(403).send({
                    message: "บัญชีของคุณถูกล็อค กรุณาลองใหม่ในภายหลัง",
                    status: false
                });
            }

            if (password === user.password) {  
                // รีเซ็ตค่า
                const resetAttemptsSql = "UPDATE customer SET loginAttempts = 0, lockoutTime = NULL WHERE customerID = ?";
                db.query(resetAttemptsSql, [user.customerID]);

                // Generate token
                const token = jwt.sign({ id: user.customerID }, secureKey, { expiresIn: '2h' });
                user.token = token;
                user['message'] = "เข้าสู่ระบบสำเร็จ";
                user['status'] = true;
                res.send(user);
            } else {
                // เพิ่มจำนวนการเข้าสู่ระบบ
                const newAttempts = user.loginAttempts + 1;
                let lockoutTime = null;

                if (newAttempts >= 5) { // ล็อคบัญชีหลังจากพยายามไม่สำเร็จ 5 ครั้ง
                    lockoutTime = new Date();
                    lockoutTime.setMinutes(lockoutTime.getMinutes() + 30); // Lock for 30 minutes
                }

                const updateAttemptsSql = "UPDATE customer SET loginAttempts = ?, lockoutTime = ? WHERE customerID = ?";
                db.query(updateAttemptsSql, [newAttempts, lockoutTime, user.customerID]);

                res.status(403).send({
                    message: newAttempts >= 5
                        ? "บัญชีของคุณถูกล็อคหลังจากความพยายามเข้าสู่ระบบล้มเหลวเกิน 5 ครั้ง กรุณาลองใหม่ในภายหลัง"
                        : "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
                    status: false
                });
            }
            // });
        } else {
            res.status(404).send({
                message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
                status: false
            });
        }
    });
});


app.listen(port, function () {
    console.log(`server listening on port ${port}`)
})