const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "twitterClone.db");

const app = express();

app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

app.post("/register/", async (request, response) => {
  const { name, username, password, gender } = request.body;
  const query = `select * from user where username=${username}`;
  const queryResult = await database.get(query);
  if (queryResult !== undefined) {
    response.status(400);
    response.send("user already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const registerQuery = `insert into user (username,name,password,gender)
            values('${username}','${name}','${hashedPassword}','${gender}')`;
      await database.run(registerQuery);
      response.send("User created successfully");
    }
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await database.get(selectUserQuery);
  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// API4

app.get("/user/following/", authenticateToken, async (request, response) => {
  const query = `select distinct name from user  join  follower
    on user.user_id=follower.follower_user_id `;
  const result = await database.all(query);
  response.send(result);
});

// API5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const query = `select distinct name from user  join  follower
    on user.user_id=follower.following_user_id `;
  const result = await database.all(query);
  response.send(result);
});

//API 6

app.get("/tweets/:tweetId", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;

  const query = `select * from tweet where tweet_id=${tweetId}`;
  const result = await database.all(query);
  if (result.length === 0) {
    response.status(400);
    response.send("Invalid Request");
  } else {
    response.send(result);
  }
});

// api 7:

app.get(
  "/tweets/:tweetId/likes",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;

    const query = `select name from (tweet join 
  like on  tweet.tweet_id=like.tweet_id) as t join user
  on t.user_id=user.user_id
  where tweet.tweet_id=${tweetId}`;
    const result = await database.all(query);
    if (result.length === 0) {
      response.status(400);
      response.send("Invalid Request");
    } else {
      response.send({ likes: [result.map((each) => each.name)] });
    }
  }
);
//api 8

app.get(
  "/tweets/:tweetId/replies",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;

    const query = `select name,reply from (tweet join 
  reply on  tweet.tweet_id=reply.tweet_id) as t join user
  on user.user_id=t.user_id
  where tweet.tweet_id=${tweetId}`;
    const result = await database.all(query);
    if (result.length === 0) {
      response.status(400);
      response.send("Invalid Request");
    } else {
      response.send({ replies: result });
    }
  }
);

// api 9:
app.get("user/tweets/", async (request, response) => {});

//  api 11
app.delete("/tweets/:tweetId", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const query = `delete from tweet where tweet_id=${tweetId}`;

  const result = await database.run(query);
  if (result.length === 0) {
    response.status(400);
    response.send("Invalid Request");
  } else {
    response.send("Tweet removed");
  }
});

module.exports = app;
