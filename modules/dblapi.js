const DBL = require('dblapi.js');
const utils = require('./localutils.js');
const dbManager = require('./dbmanager.js');
const port = 3001;

const settings = require('../settings/general.json');
const dbl = new DBL(settings.dbltoken, { webhookPort: port, webhookAuth: settings.dblpass });

var mongodb, client, ccollection, ucollection;

dbl.webhook.on('ready', hook => {
    console.log(`Webhook running at http://${hook.hostname}:${hook.port}${hook.path}`);
});

dbl.webhook.on('error', e => {
    console.log(`[DBL] ${e}`);
});

function connect(db, bot) {
    mongodb = db;
    client = bot;
    ccollection = db.collection("cards");
    ucollection = db.collection("users");

    setInterval(() => {
        dbl.postStats(Object.keys(client.servers).length);
    }, 1800000);

    dbl.webhook.on('vote', vote => {
        console.log(`User with ID ${vote.user} just voted!`);
        getCard(vote.user);
    });
}

function getCard(userID) {
    ucollection.findOne({ discord_id: userID }).then((dbUser) => {
        if(!dbUser)
            return;

        ccollection.aggregate([ 
            { $match: { level : { $lt: 4 }}},
            { $sample: { size: 1 } } 
        ]).toArray((err, res) => {
            let card = res[0];
            dbUser.cards = dbManager.addCardToUser(dbUser.cards, card);

            if(!card || !dbUser.cards)
                return;

            ucollection.update(
                { discord_id: userID },
                {
                    $set: {cards: dbUser.cards}
                }
            ).then(() => {
                let url = dbManager.getCardURL(card);
                client.sendMessage({to: userID, embed: utils.formatImage(null, null, 
                    "Thank you for your vote!\nYou got [" + utils.getFullCard(card) + "]("
                    + url + ")\nVote again for free claim in 12 hours.", url)});
            });
        });
    }).catch(e => console.log(e));
}

module.exports = { connect }
