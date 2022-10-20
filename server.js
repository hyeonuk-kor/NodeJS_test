const fs = require("fs");
// 서버를 띄우기 위한 기본 셋팅
const express = require("express"); //express 라이브러리 셋팅
const app = express(); //객체 만들기
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
const MongoClient = require("mongodb").MongoClient;
const methodOverride = require("method-override");

const http = require("http").createServer(app);
const { Server } = require("socket.io");
const io = new Server(http);

app.use(methodOverride("_method"));
app.set("view engine", "ejs");
app.use("/public", express.static("public"));
require("dotenv").config();
let db;
MongoClient.connect(process.env.DB_URL, function (에러, client) {
	if (에러) return console.log(에러);
	db = client.db("petpy_db");
	http.listen(8080, function () {
		console.log("listening on " + 8080);
	});
});

// 누군가 /pet으로 방문하면 pet관련된 안내문을 띄워주자.
app.get("/pet", function (요청, 응답) {
	응답.send("펫 용품을 살 수 있는 페이지입니다.");
});

app.get("/beauty", function (요청, 응답) {
	응답.send("뷰티용품사세요");
});

app.get("/", function (요청, 응답) {
	응답.render("index.ejs");
});
app.get("/write", function (요청, 응답) {
	응답.render("write.ejs");
});

app.get("/list", function (요청, 응답) {
	db.collection("post")
		.find()
		.toArray(function (에러, 결과) {
			console.log("++\n");
			console.log(결과);
			응답.render("list.ejs", { posts: 결과 });
		});
});

app.get("/search", (요청, 응답) => {
	//console.log(요청.query.value);
	var 검색조건 = [
		{
			$search: {
				index: "titleSearch",
				text: {
					query: 요청.query.value,
					path: "제목", // 제목날짜 둘다 찾고 싶으면 ['제목', '날짜']
				},
			},
		},
		{ $sort: { _id: 1 } },
		{ $limit: 2 },
		/*
		{ $project: { 제목: 1, _id: 0, score: { $meta: "searchScore" } } }, //내가 원하는 것만 보여줌 */
	];
	db.collection("post")
		.aggregate(검색조건)
		.toArray((에러, 결과) => {
			console.log(결과);
			응답.render("search.ejs", { posts: 결과 });
		});
});

app.get("/detail/:id", function (요청, 응답) {
	db.collection("post").findOne(
		{ _id: parseInt(요청.params.id) },
		function (에러, 결과) {
			console.log(결과);
			응답.render("detail.ejs", { data: 결과 });
		}
	);
});

app.get("/edit/:id", function (요청, 응답) {
	db.collection("post").findOne(
		{ _id: parseInt(요청.params.id) },
		function (에러, 결과) {
			console.log(결과);
			응답.render("edit.ejs", { post: 결과 });
		}
	);
});

app.put("/edit", function (요청, 응답) {
	db.collection("post").updateOne(
		{ _id: parseInt(요청.body.id) },
		{ $set: { 제목: 요청.body.title, 날짜: 요청.body.date } },
		function (에러, 결과) {
			console.log("수정완료");
			응답.redirect("/list");
		}
	);
});

const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
app.use(
	session({ secret: "비밀코드", resave: true, saveUninitialized: false })
);
app.use(passport.initialize());
app.use(passport.session());
app.get("/login", function (요청, 응답) {
	응답.render("login.ejs");
});
app.post(
	"/login",
	passport.authenticate("local", { failureRedirect: "/fail" }),
	function (요청, 응답) {
		응답.redirect("/");
	}
);
app.get("/mypage", 로그인했니, function (요청, 응답) {
	console.log(요청.user);
	응답.render("mypage.ejs", { 사용자: 요청.user });
});
function 로그인했니(요청, 응답, next) {
	if (요청.user) {
		next();
	} else {
		응답.send("로그인안하셨는데요?");
	}
}
passport.use(
	new LocalStrategy(
		{
			usernameField: "id",
			passwordField: "pw",
			session: true,
			passReqToCallback: false,
		},
		function (입력한아이디, 입력한비번, done) {
			//console.log(입력한아이디, 입력한비번);
			db.collection("login").findOne(
				{ id: 입력한아이디 },
				function (에러, 결과) {
					if (에러) return done(에러);

					if (!결과)
						return done(null, false, {
							message: "존재하지않는 아이디요",
						});
					if (입력한비번 == 결과.pw) {
						return done(null, 결과);
					} else {
						return done(null, false, { message: "비번틀렸어요" });
					}
				}
			);
		}
	)
);

passport.serializeUser(function (user, done) {
	done(null, user.id);
});

passport.deserializeUser(function (아이디, done) {
	// 디비에서 위에있는 user.id로 유저를 찾은 뒤에 유저 정보를 아래 결과에 넣음
	db.collection("login").findOne({ id: 아이디 }, function (에러, 결과) {
		done(null, 결과);
	});
});

app.post("/register", (요청, 응답) => {
	db.collection("login").insertOne(
		{ id: 요청.body.id, pw: 요청.body.pw },
		(에러, 결과) => {
			응답.redirect("/");
		}
	);
});

app.post("/add", function (요청, 응답) {
	응답.send("전송완료");
	db.collection("counter").findOne(
		{ name: "게시물갯수" },
		function (에러, 결과) {
			console.log(결과.totalPost);
			var 총게시물갯수 = 결과.totalPost;
			var 저장할거 = {
				_id: 총게시물갯수 + 1,
				작성자: 요청.user._id,
				제목: 요청.body.title,
				날짜: 요청.body.date,
			};
			db.collection("post").insertOne(저장할거, function () {
				console.log("저장완료");
				db.collection("counter").updateOne(
					{ name: "게시물갯수" },
					{ $inc: { totalPost: 1 } }, // operator 써야함
					function (에러, 결과) {
						if (에러) {
							return console.log(에러);
						}
					}
				);
			});
		}
	);
});

app.delete("/delete", function (요청, 응답) {
	console.log("삭제할 데이터는?");
	console.log(요청.body);
	요청.body._id = parseInt(요청.body._id);
	var 삭제할데이터 = { _id: 요청.body._id, 작성자: 요청.user._id };
	console.log(삭제할데이터);
	db.collection("post").deleteOne(삭제할데이터, function (에러, 결과) {
		console.log("삭제완료");
		if (에러) console.log(에러);
		응답.status(200).send({ message: "성공했습니다." });
	});
});

app.use("/shop", require("./routes/shop.js")); // 미들웨어를 쓰고 싶을 때 use 사용, / 경로로 요청했을 때 라우터 적용~

app.use("/board/sub", require("./routes/board.js"));

let multer = require("multer");
var storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, "./public/image");
	},
	filename: function (req, file, cb) {
		cb(null, file.originalname);
	},
});
var path = require("path");

var upload = multer({
	storage: storage,
	fileFilter: function (req, file, callback) {
		var ext = path.extname(file.originalname);
		if (ext !== ".png" && ext !== ".jpg" && ext !== ".jpeg") {
			return callback(new Error("PNG, JPG만 업로드하세요"));
		}
		callback(null, true);
	},
	limits: {
		fileSize: 1024 * 1024,
	},
});
app.get("/upload", (요청, 응답) => {
	응답.render("upload.ejs");
});
app.post("/upload", upload.single("profile"), (요청, 응답) => {
	응답.send("업로드완료");
});

app.get("/image/:imageName", (요청, 응답) => {
	응답.sendFile(__dirname + "/public/image/" + 요청.params.imageName);
});
const { ObjectId } = require("mongodb");
app.post("/chatroom", 로그인했니, function (요청, 응답) {
	console.log("요청들어옴");
	var 저장할거 = {
		title: "무슨무슨채팅방",
		member: [ObjectId(요청.body.당한사람id), 요청.user._id],
		date: new Date(),
	};
	console.log(저장할거);
	db.collection("chatroom")
		.insertOne(저장할거)
		.then(function (결과) {
			응답.send("저장완료");
		});
});

app.get("/chat", 로그인했니, function (요청, 응답) {
	db.collection("chatroom")
		.find({ member: 요청.user._id })
		.toArray()
		.then((결과) => {
			console.log(결과);
			응답.render("chat.ejs", { data: 결과 });
		});
});

app.post("/message", 로그인했니, function (요청, 응답) {
	var 저장할거 = {
		parent: 요청.body.parent,
		content: 요청.body.content,
		userid: 요청.user._id,
		date: new Date(),
	};
	console.log(저장할거);
	db.collection("message")
		.insertOne(저장할거)
		.then(() => {
			console.log("db저장성공");
		});
});

app.get("/message/:parentid", 로그인했니, function (요청, 응답) {
	응답.writeHead(200, {
		Connection: "keep-alive",
		"Content-Type": "text/event-stream;charset=utf-8",
		"Cache-Control": "no-cache",
	});

	db.collection("message")
		.find({ parent: 요청.params.parentid })
		.toArray()
		.then((결과) => {
			console.log(결과);
			응답.write("event: test\n");
			응답.write(`data: ${JSON.stringify(결과)}\n\n`);
		});

	const 찾을문서 = [
		{ $match: { "fullDocument.parent": 요청.params.parentid } },
	];

	const changeStream = db.collection("message").watch(찾을문서);
	changeStream.on("change", (result) => {
		console.log("hnkjhkhkjhkj-----");
		console.log(result.fullDocument);
		var 추가된문서 = [result.fullDocument];
		응답.write("event: test\n");
		응답.write(`data: ${JSON.stringify(추가된문서)}\n\n`);
	});
});

app.get("/socket", function (요청, 응답) {
	응답.render("socket.ejs");
});

io.on("connection", function (socket) {
	console.log("유저접속됨");
	console.log(socket.id); // 유저 구분!

	socket.on("joinroom", function (data) {
		socket.join("room1");
	});

	socket.on("room1-send", function (data) {
		io.to("room1").emit("broadcast", data);
	});
	socket.on("user-send", function (data) {
		io.emit("broadcast", data);
		console.log(data);
	});
});
