// Dependencies
var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var path = require("path");

// Requiring Note and Article models
var Note = require("./models/Note.js");
var Article = require("./models/Article.js");

// Scraping tools
var request = require("request");
var cheerio = require("cheerio");


mongoose.Promise = Promise;

//Define port
var port = process.env.PORT || 3000

// Initialize Express
var app = express();


app.use(logger("dev"));
app.use(bodyParser.urlencoded({
  extended: false
}));

// Make public a static dir
app.use(express.static("public"));

// Set Handlebars.
var exphbs = require("express-handlebars");

app.engine("handlebars", exphbs({
    defaultLayout: "main",
    partialsDir: path.join(__dirname, "/views/layouts/partials")
}));
app.set("view engine", "handlebars");


mongoose.connect("mongodb://localhost/newsapp");

var db = mongoose.connection;

// Show any mongoose errors
db.on("error", function(error) {
  console.log("Mongoose Error: ", error);
});


db.once("open", function() {
  console.log("Mongoose connection successful.");
});


app.get("/", function(req, res) {
  Article.find({"saved": false}, function(error, data) {
    var hbsObject = {
      article: data
    };
    console.log(hbsObject);
    res.render("home", hbsObject);
  });
});

app.get("/saved", function(req, res) {
  Article.find({"saved": true}).populate("notes").exec(function(error, articles) {
    var hbsObject = {
      article: articles
    };
    res.render("saved", hbsObject);
  });
});


app.get("/scrape", function(req, res) {

  request("https://www.nytimes.com/", function(error, response, html) {
 
    var $ = cheerio.load(html);

    $("article").each(function(i, element) {

      // Save an empty result object
      var result = {};

   
      result.title = $(this).children("h2").text();
      result.summary = $(this).children(".summary").text();
      result.link = $(this).children("h2").children("a").attr("href");


      var entry = new Article(result);

      // Now, save that entry to the db
      entry.save(function(err, doc) {
        // Log any errors
        if (err) {
          console.log(err);
        }
        // Or log the doc
        else {
          console.log(doc);
        }
      });

    });
        res.send("Scrape Complete");

  });

});


app.get("/articles", function(req, res) {
  
  Article.find({}, function(error, doc) {
    
    if (error) {
      console.log(error);
    }
    
    else {
      res.json(doc);
    }
  });
});

// Grab an article by it's ObjectId
app.get("/articles/:id", function(req, res) {

  Article.findOne({ "_id": req.params.id })
 
  .populate("note")
  // now, execute our query
  .exec(function(error, doc) {
    // Log any errors
    if (error) {
      console.log(error);
    }
  
    else {
      res.json(doc);
    }
  });
});


// Save an article
app.post("/articles/save/:id", function(req, res) {
      // Use the article id to find and update its saved boolean
      Article.findOneAndUpdate({ "_id": req.params.id }, { "saved": true})
      // Execute the above query
      .exec(function(err, doc) {
        // Log any errors
        if (err) {
          console.log(err);
        }
        else {
          // Or send the document to the browser
          res.send(doc);
        }
      });
});

// grabs the article by its ID
app.post("/articles/delete/:id", function(req, res) {
      
      Article.findOneAndUpdate({ "_id": req.params.id }, {"saved": false, "notes": []})
      // Execute the above query
      .exec(function(err, doc) {
        // Log any errors
        if (err) {
          console.log(err);
        }
        else {
         
          res.send(doc);
        }
      });
});


// Create a new note
app.post("/notes/save/:id", function(req, res) {
  // Create a new note and pass the req.body to the entry
  var newNote = new Note({
    body: req.body.text,
    article: req.params.id
  });
  console.log(req.body)
  // And save the new note the db
  newNote.save(function(error, note) {
    // Log any errors
    if (error) {
      console.log(error);
    }
    // Otherwise
    else {
     
      Article.findOneAndUpdate({ "_id": req.params.id }, {$push: { "notes": note } })
    
      .exec(function(err) {
       
        if (err) {
          console.log(err);
          res.send(err);
        }
        else {
       
          res.send(note);
        }
      });
    }
  });
});

// Delete a note
app.delete("/notes/delete/:note_id/:article_id", function(req, res) {
  
  Note.findOneAndRemove({ "_id": req.params.note_id }, function(err) {
    
    if (err) {
      console.log(err);
      res.send(err);
    }
    else {
      Article.findOneAndUpdate({ "_id": req.params.article_id }, {$pull: {"notes": req.params.note_id}})
      
        .exec(function(err) {
         
          if (err) {
            console.log(err);
            res.send(err);
          }
          else {
            
            res.send("Note Deleted");
          }
        });
    }
  });
});

// Listen on port
app.listen(port, function() {
  console.log("App running on port " + port);
});
