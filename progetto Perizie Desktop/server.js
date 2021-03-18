"use strict";

const http = require("http");
const fs = require("fs");
const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require('nodemailer');

let mongo = require("mongodb");
let mongoClient = mongo.MongoClient;
const CONNECTIONSTRING = "mongodb+srv://CavalloLuca:LucaCavallo10@cluster0.nwngt.mongodb.net/test";
const CONNECTIONOPTIONS = { useNewUrlParser: true, useUnifiedTopology: true };
const DBNAME = "Assicurazioni";
const TTL_Token = 600; //espresso in sec 
//const TTL_Token = 2592000; //30 giorni

const PORT = process.env.PORT || 1337;

let paginaErrore;
let currentUser;

const privateKey = fs.readFileSync("keys/privateKey.pem", "utf8");
/*const certificate = fs.readFileSync("keys/certificate.pem", "utf8");
const credentials = { "key": privateKey, "cert": certificate };*/

const server = http.createServer(app);
server.listen(PORT, function () {
    console.log("Server in ascolto sulla porta " + PORT);
    init();
});

app.use(cors());
app.use(express.json({ "limit": "50mb" }));
app.set("json spaces", 4);

function init() {
    fs.readFile("./static/error.html", function (err, data) {
        if (!err)
            paginaErrore = data.toString();
        else
            paginaErrore = "<h1>Risorsa non trovata</h1>";
    });

    /*fs.readFile("./keys/private.key", function (err, data) {
        if (!err) {
            privateKey = data.toString();
        }
        else {
            //Richiamo la route di gestione degli errori
            console.log("File mancante: private.key");
            server.close();
        }
    })*/

    app.response.log = function (message) {
        console.log("Erorore: " + message);
    }
}

//Log della richiesta
app.use('/', function (req, res, next) {
    //originalUrl contiene la risorsa richiesta
    console.log(">>>>>>>>>> " + req.method + ":" + req.originalUrl);
    next();
});

//Route di lettura dei parametri post
app.use(bodyParser.urlencoded({ "extended": true }));
app.use(bodyParser.json());

//Log dei parametri
app.use("/", function (req, res, next) {
    if (Object.keys(req.query).length > 0) {
        console.log("Parametri GET: " + JSON.stringify(req.query));
    }
    if (Object.keys(req.body).length > 0) {
        console.log("Parametri BODY: " + JSON.stringify(req.body));
    }
    next();
});

//Route per fare in modo che il server risponda a qualunque richiesta anche extra-domain.
app.use("/", function (req, res, next) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
})

/********** Middleware specifico relativo a JWT **********/
//Per tutte le pagine su cui si vuole fare il controllo del token, si aggiunge un listener di questo tipo

//Questa route deve essere scritta prima del metodo controllaToken()
app.post("/api/checkUserPwd", function (req, res, next) {
    mongoClient.connect(CONNECTIONSTRING, CONNECTIONOPTIONS, function (err, client) {
        if (err)
            res.status(503).send("Errore di connessione al database");
        else {
            const db = client.db(DBNAME);
            let collection = db.collection("Utenti");

            let nominativo = req.body.username;
            let password = req.body.password;

            collection.findOne({ "$or": [{ "nominativo": nominativo }, { "mail": nominativo }] }, function (err, data) {
                if (err)
                    res.status(500).send("Internal Error in Query Execution").log(err.message);
                else {
                    console.log(data);
                    bcrypt.compare(password, data.password, function (err, ok) {
                        if (err)
                            res.status(500).send("Internal Error in bcrypt compare").log(err.message);
                        else {
                            if (!ok)
                                res.status(401).send("Username e/o Password non validi");
                            else {
                                if (data["primoaccesso"])
                                    res.send({ "cambioPwd": true });
                                else
                                    res.send({ "cambioPwd": false });
                            }
                            client.close();
                        }
                    });

                }
            });
        }
    });
});

app.post("/api/changePwd", function (req, res, next) {
    mongoClient.connect(CONNECTIONSTRING, CONNECTIONOPTIONS, function (err, client) {
        if (err)
            res.status(503).send("Errore di connessione al database");
        else {
            const db = client.db(DBNAME);
            let collection = db.collection("Utenti");

            let username = req.body.username;
            let password = req.body.password;

            collection.updateOne({ "$or": [{ "nominativo": username }, { "mail": username }] },
                { "$set": { "password": bcrypt.hashSync(password, 10), "primoaccesso": false } },
                function (err, data) {
                    if (err)
                        res.status(500).send(err.message);
                    else {
                        res.send({ "ris": "ok" });
                    }
                    client.close();
                });
        }
    });
});

app.post('/api/login', function (req, res, next) {
    mongoClient.connect(CONNECTIONSTRING, CONNECTIONOPTIONS, function (err, client) {
        if (err)
            res.status(503).send("Errore di connessione al database").log(err.message);
        else {
            const db = client.db(DBNAME);
            const collection = db.collection("Utenti");

            let username = req.body.username;
            let desktop = req.body.desktop;

            if (desktop) {
                collection.findOne({ "$and": [{ "$or": [{ "nominativo": username }, { "mail": username }] }, { "admin": desktop }] }, function (err, dbUser) {
                    if (err)
                        res.status(500).send("Internal Error in Query Execution").log(err.message);
                    else {
                        if (dbUser == null)
                            res.status(401).send("Username e/o Password non validi");
                        else {
                            bcrypt.compare(req.body.password, dbUser.password, function (err, ok) {
                                if (err)
                                    res.status(500).send("Internal Error in bcrypt compare").log(err.message);
                                else {
                                    if (!ok)
                                        res.status(401).send("Username e/o Password non validi");
                                    else {
                                        if (dbUser.primoaccesso) {
                                            res.send({ "pa": true });
                                        }
                                        else {
                                            let token = createToken(dbUser);
                                            writeCookie(res, token);
                                            currentUser = dbUser["_id"];
                                            res.send(JSON.stringify(dbUser));
                                        }
                                    }
                                    client.close();
                                }
                            });
                        }
                    }
                });
            }
            else {
                collection.findOne({ "$or": [{ "nominativo": username }, { "mail": username }] }, function (err, dbUser) {
                    if (err)
                        res.status(500).send("Internal Error in Query Execution").log(err.message);
                    else {
                        if (dbUser == null)
                            res.status(401).send("Username e/o Password non validi");
                        else {
                            bcrypt.compare(req.body.password, dbUser.password, function (err, ok) {
                                if (err)
                                    res.status(500).send("Internal Error in bcrypt compare").log(err.message);
                                else {
                                    if (!ok)
                                        res.status(401).send("Username e/o Password non validi");
                                    else {
                                        if (dbUser.primoaccesso) {
                                            res.send({ "pa": true });
                                        }
                                        else {
                                            let token = createToken(dbUser);
                                            writeCookie(res, token);
                                            currentUser = dbUser["_id"];
                                            res.send(JSON.stringify(dbUser));
                                        }
                                    }
                                    client.close();
                                }
                            });
                        }
                    }
                });
            }

        }
    });
});

app.use("/api", function (req, res, next) {
    controllaToken(req, res, next);
});

app.get("/", function (req, res, next) {
    controllaToken(req, res, next);
});

app.get("/index.html", function (req, res, next) {
    controllaToken(req, res, next);
});

app.post('/api/logout', function (req, res, next) {
    // viene creato un token vuoto che viene messo in un cookie scaduto
    res.set("Set-Cookie", `token="";max-age=-1;path=/;httponly=true`);
    res.send({ "ris": "ok" });
});

function controllaToken(req, res, next) {
    let token = readCookie(req);
    if (token == "") {
        inviaErrore(req, res, 403, "Token mancante");
    }
    else {
        jwt.verify(token, privateKey, function (err, payload) {
            if (err) {
                inviaErrore(req, res, 403, "Token scaduto o corrotto");
            }
            else {
                let newToken = createToken(payload);
                writeCookie(res, newToken);
                req.payload = payload; //salvo il payload dentro request in modo che le api successive lo possano leggere e ricavare i dati necessari
                next();
            }
        });
    }
}

//La route delle risorse statiche DEVE essere eseguita DOPO controllaToken()
app.use('/', express.static("./static")); 
/*app.use('/', express.static("./www"));
app.use('/', express.static("./www/login")); */

function inviaErrore(req, res, cod, errorMessage) {
    if (req.originalUrl.startsWith("/api/")) {
        res.status(cod).send(errorMessage);
    }
    else {
        res.sendFile(__dirname + "/static/login.html");
    }
}

function readCookie(req) {
    let valoreCookie = "";
    if (req.headers.cookie) {
        let cookies = req.headers.cookie.split(';');
        for (let item of cookies) {
            item = item.split('='); //item = chiave=valore --> split --> [chiave, valore]
            if (item[0].includes("token")) {
                valoreCookie = item[1];
                break;
            }
        }
    }
    return valoreCookie; // se non lo trova vale stringa vuota
}

//data --> record dell'utente
function createToken(data) {
    //sign() --> si aspetta come parametro un json con i parametri che si vogliono mettere nel token
    let json = {
        "_id": data["_id"],
        "username": data["username"],
        "iat": data["iat"] || Math.floor((Date.now() / 1000)),
        "exp": (Math.floor((Date.now() / 1000)) + TTL_Token)
    }
    let token = jwt.sign(json, privateKey);
    console.log(token);
    return token;

}

function writeCookie(res, token) {
    //set() --> metodo di express che consente di impostare una o più intestazioni nella risposta HTTP
    res.set("Set-Cookie", `token=${token};max-age=${TTL_Token};path=/;httponly=true;secure=true`);
}

function generaPassword() {
    let pwd = "";
    for (let i = 0; i < random(5, 10); i++) {
        let n = random(0, 9);
        pwd += n.toString();
    }

    return pwd.toString();
}

function random(a, b) {
    return Math.floor((b - a + 1) * Math.random()) + a;
}

/********** Api di risposta alle richieste **********/
app.post('/api/me', function (req, res, next) {
    mongoClient.connect(CONNECTIONSTRING, CONNECTIONOPTIONS, function (err, client) {
        if (err)
            res.status(503).send("Errore di connessione al database");
        else {
            res.send({ "myCode": currentUser });
        }
    });
});

app.post('/api/caricaFoto', function (req, res, next) {
    mongoClient.connect(CONNECTIONSTRING, CONNECTIONOPTIONS, function (err, client) {
        if (err)
            res.status(503).send("Errore di connessione al database");
        else {
            const db = client.db(DBNAME);
            let collectUser = db.collection("Utenti");
            let collectFoto = db.collection("Fotografie");

            let utente = req.body.user;
            let img = req.body.img;
            let lat = req.body.lat;
            let lng = req.body.lng;
            let nowTime = req.body.nowTime;
            let todayDay = req.body.todayDay;
            let descr = req.body.descr;

            let ObjectId = mongo.ObjectId;
            let id = new ObjectId(utente);

            collectUser.findOne({ "_id": id }, function (err, data) {
                if (err)
                    res.status(500).send("Internal Error in Query Execution").log(err.message);
                else {
                    collectFoto.insertOne({
                        "utente": data["nominativo"],
                        "img": img,
                        "lat": lat,
                        "lng": lng,
                        "nowTime": nowTime,
                        "todayDay": todayDay,
                        "descr": descr
                    }, function (err, data) {
                        if (err)
                            res.status(500).send(err.message);
                        else {
                            res.send(JSON.stringify(data));
                        }
                        client.close();
                    });
                }
            });
        }
    });
});

app.post("/api/addUser", function (req, res, next) {
    mongoClient.connect(CONNECTIONSTRING, CONNECTIONOPTIONS, function (err, client) {
        if (err)
            res.status(503).send("Errore di connessione al database");
        else {
            const db = client.db(DBNAME);
            let collection = db.collection("Utenti");

            let nominativo = req.body.nominativo;
            let mail = req.body.mail;
            let admin = req.body.admin;

            let password = generaPassword();

            collection.find({ "$or": [{ "nominativo": nominativo }, { "mail": mail }] }).toArray(function (err, data) {
                if (err)
                    res.status(500).send("Internal Error in Query Execution").log(err.message);
                else {
                    if (data.length == 0) {
                        collection.insertOne({
                            "nominativo": nominativo,
                            "mail": mail,
                            "admin": admin,
                            "password": bcrypt.hashSync(password, 10),
                            "primoaccesso": true
                        }, function (err, data) {
                            if (err)
                                res.status(500).send(err.message);
                            else
                                res.send({ "nom": nominativo, "pwd": password });
                            client.close();
                        });
                    }
                    else {
                        res.status(401).send("Username e/o mail già presenti nel db.");
                    }

                }
            });
        }
    });
});

app.post("/api/viewUsers", function (req, res, next) {
    mongoClient.connect(CONNECTIONSTRING, CONNECTIONOPTIONS, function (err, client) {
        if (err)
            res.status(503).send("Errore di connessione al database");
        else {
            const db = client.db(DBNAME);
            let collection = db.collection("Utenti");

            collection.find({}).project({ "nominativo": 1, "admin": 1 }).toArray(function (err, data) {
                if (err)
                    res.status(500).send(err.message);
                else
                    res.send(JSON.stringify(data));
                client.close();
            });
        }
    });
});

app.post("/api/allFoto", function (req, res, next) {
    mongoClient.connect(CONNECTIONSTRING, CONNECTIONOPTIONS, function (err, client) {
        if (err)
            res.status(503).send("Errore di connessione al database");
        else {
            const db = client.db(DBNAME);
            let collection = db.collection("Fotografie");

            collection.find({}).toArray(function (err, data) {
                if (err)
                    res.status(500).send(err.message);
                else
                    res.send(JSON.stringify(data));
                client.close();
            });
        }
    });
});

app.post("/api/addDescr", function (req, res, next) {
    mongoClient.connect(CONNECTIONSTRING, CONNECTIONOPTIONS, function (err, client) {
        if (err)
            res.status(503).send("Errore di connessione al database");
        else {
            const db = client.db(DBNAME);
            let collection = db.collection("Fotografie");

            let descr = req.body.descr;
            let ObjectId = mongo.ObjectId;
            let id = new ObjectId(req.body.id);

            collection.updateOne({ "_id": id }, { "$set": { "descPersAmm": descr } }, function (err, data) {
                if (err)
                    res.status(500).send(err.message);
                else {
                    res.send({ "ris": "ok" });
                }
                client.close();
            });
        }
    });
});

app.post('/api/sendMail', function (req, res, next) {
    mongoClient.connect(CONNECTIONSTRING, CONNECTIONOPTIONS, function (err, client) {
        if (err)
            res.status(503).send("Errore di connessione al database").log(err.message);
        else {
            const db = client.db(DBNAME);
            const collection = db.collection("Utenti");

            let mail = req.body.mail;
            let password = req.body.password;

            collection.findOne({ "mail": mail }, function (err, data) {
                if (err) {
                    res.status(500).send("Internal Error in Query Execution").log(err.message);
                }
                else {
                    if (data) {
                        var transporter = nodemailer.createTransport({
                            service: 'gmail',
                            auth: {
                                user: 'progettoPerizieCavallo@gmail.com',
                                pass: 'progetto12345',
                                accessToken: "AIzaSyCW4UKYwj5zfLgPUl6j3zAeUmyfdSnPOpY"
                            }
                        });

                        var mailOptions = {
                            from: 'progettoPerizieCavallo@gmail.com',
                            to: mail,
                            subject: 'Password per effettuare il primo login.',
                            text: "La tua prima password è: " + password + "."
                        };

                        transporter.sendMail(mailOptions, function (error, info) {
                            if (error) {
                                console.log(error);
                            } else {
                                console.log('Email sent: ' + info.response);
                            }
                        });
                        res.send({ "ris": "ok" });
                        client.close();
                    }
                    else {
                        res.send({ "ris": "nok" });
                        client.close();
                    }

                }
            });
        }
    });
});


/********** Route di gestione degli errori **********/

app.use("/", function (req, res, next) {
    res.status(404);
    if (req.originalUrl.startsWith("/api/")) {
        //res.send('"Risorsa non trovata"'); //non va così bene, perchè content-type viene messo = "text"
        res.json("Risorsa non trovata"); //La serializzazione viene fatta dal metodo json()
        //res.send({"ris":"Risorsa non trovata"});
    }
    else {
        res.send(paginaErrore);
    }
});

app.use(function (err, req, res, next) {
    console.log(err.stack);
});