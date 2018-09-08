const express = require('express');
const app = express();
const index = require("./index")

// set the port of our application
// process.env.PORT lets the port be set by Heroku
var port = process.env.PORT || 8080;

// set the home page route
app.get('/trigger', async function(req, res) {
    try {
        await index.main()
        res.send("OK")
    } catch (e) {
        res.status(500).send(e)
    }
    
});

app.listen(port, function() {
    console.log('Our app is running on http://localhost:' + port);
});