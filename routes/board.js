var router = require("express").Router();
router.get("/game", function (요청, 응답) {
	응답.send("게임 게시판이다.");
});
router.get("/sports", function (요청, 응답) {
	응답.send("스포츠 페이지입니다.");
});
module.exports = router; // 다른 곳에서 shop.js를 쓰고싶을 때 내보내고 싶은 변수이름
