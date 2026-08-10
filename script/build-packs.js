#!/usr/bin/env node
// Build sample Gig Packs from the app's own catalog + lyricbook.
// Each pack: ~100 songs curated in gig order, split into 3 sets,
// every song verified to have lyrics in the offline lyric book.
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, "catalog.json"), "utf8"));
const BOOK = JSON.parse(fs.readFileSync(path.join(__dirname, "lyricbook.json"), "utf8"));

function norm(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .trim()
    .toLowerCase();
}
function lyricHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h % 8;
}
const catIndex = {};
CATALOG.forEach(([t, a, k, b]) => {
  const key = norm(t);
  if (!catIndex[key]) catIndex[key] = [];
  catIndex[key].push([t, a, k, b]);
});
function hasLyrics(t, a) {
  return !!BOOK[norm(t) + "|" + norm(a)];
}

function resolve(title, artist) {
  const cands = catIndex[norm(title)] || [];
  if (!cands.length) return null;
  let best = cands[0];
  if (artist) {
    const na = norm(artist);
    const scored = cands.map((c) => {
      const ca = norm(c[1]);
      let s = 0;
      if (ca === na) s = 2;
      else if (ca.includes(na) || na.includes(ca)) s = 1;
      return [s, c];
    }).sort((a, b) => b[0] - a[0]);
    if (scored[0][0] >= 1) best = scored[0][1];
    else if (scored[0][0] === 0 && cands.length === 1) best = cands[0];
  }
  return best;
}

function buildPack(pack) {
  const kept = [];
  const dropped = { noCatalog: [], noLyrics: [] };
  pack.songs.forEach(([t, a]) => {
    const c = resolve(t, a);
    if (!c) { dropped.noCatalog.push(t + " | " + a); return; }
    if (!hasLyrics(c[0], c[1])) { dropped.noLyrics.push(c[0] + " | " + c[1]); return; }
    kept.push([c[0], c[1], c[2] || "", c[3] || ""]);
  });
  // split into 3 consecutive sets (curation is in gig order)
  const third = Math.ceil(kept.length / 3);
  const sets = [
    { name: "Set A", vibe: pack.vibes[0], songs: kept.slice(0, third) },
    { name: "Set B", vibe: pack.vibes[1], songs: kept.slice(third, third * 2) },
    { name: "Set C", vibe: pack.vibes[2], songs: kept.slice(third * 2) }
  ].filter((s) => s.songs.length);
  const out = {
    id: pack.id,
    name: pack.name,
    tagline: pack.tagline,
    price: pack.price,
    sets,
    stats: {
      total: kept.length,
      lyricsCovered: kept.length,
      droppedNoCatalog: dropped.noCatalog.length,
      droppedNoLyrics: dropped.noLyrics.length
    }
  };
  const file = path.join(root, "gig-packs", pack.id + ".json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 1), "utf8");
  console.log("\n== " + pack.name + " ==");
  console.log("songs kept:", kept.length, "| dropped (not in catalog):", dropped.noCatalog.length, "| dropped (no lyrics):", dropped.noLyrics.length);
  sets.forEach((s) => console.log("  " + s.name + " (" + s.vibe + "): " + s.songs.length + " songs"));
  if (dropped.noCatalog.length) console.log("  no-catalog:", dropped.noCatalog.join("; "));
  if (dropped.noLyrics.length) console.log("  no-lyrics:", dropped.noLyrics.join("; "));
  return out;
}

const PACKS = [
  {
    id: "wedding",
    name: "Wedding Gig Pack",
    tagline: "The full wedding reception, done right — dinner, first dance and floor-fillers in one box.",
    price: 9.99,
    vibes: ["Dinner & cocktails (slower, romantic)", "First dance & celebration", "Floor-fillers & singalongs"],
    songs: [
      ["Perfect", "Ed Sheeran"], ["Thinking Out Loud", "Ed Sheeran"], ["All of Me", "John Legend"],
      ["Make You Feel My Love", "Adele"], ["Just the Way You Are", "Billy Joel"], ["Your Song", "Elton John"],
      ["A Thousand Years", "Christina Perri"], ["I Don't Want to Miss a Thing", "Aerosmith"],
      ["Wonderful Tonight", "Eric Clapton"], ["Have I Told You Lately", "Van Morrison"],
      ["Always", "Bon Jovi"], ["I'll Be", "Edwin McCain"], ["Better Together", "Jack Johnson"],
      ["Ho Hey", "The Lumineers"], ["Yellow", "Coldplay"], ["Bless the Broken Road", "Rascal Flatts"],
      ["When You Say Nothing at All", "Alison Krauss"], ["The Way You Look Tonight", "Michael Bublé"],
      ["Can't Help Falling in Love", "Elvis Presley"], ["At Last", "Etta James"],
      ["Unchained Melody", "The Righteous Brothers"], ["Wonderwall", "Oasis"],
      ["Fly Me to the Moon", "Frank Sinatra"], ["Dream a Little Dream of Me", "The Mamas & the Papas"],
      ["The Girl from Ipanema", "Stan Getz"], ["Cheek to Cheek", "Ella Fitzgerald"],
      ["Signed, Sealed, Delivered", "Stevie Wonder"], ["Isn't She Lovely", "Stevie Wonder"],
      ["Marry You", "Bruno Mars"], ["Lucky", "Jason Mraz"], ["Riptide", "Vance Joy"],
      ["Home", "Edward Sharpe & The Magnetic Zeros"], ["XO", "Beyoncé"], ["Adore You", "Harry Styles"],
      ["Halo", "Beyoncé"], ["All You Need Is Love - Remastered 2009", "The Beatles"],
      ["You Are the Best Thing", "Ray LaMontagne"], ["Best Day of My Life", "American Authors"],
      ["Happy", "Pharrell Williams"], ["Can't Stop the Feeling!", "Justin Timberlake"],
      ["Shut Up and Dance", "Walk the Moon"], ["Uptown Funk", "Mark Ronson"],
      ["I Gotta Feeling", "The Black Eyed Peas"], ["Don't Stop Me Now", "Queen"],
      ["September", "Earth, Wind & Fire"], ["Love Shack", "The B-52s"], ["Dancing Queen", "ABBA"],
      ["Mamma Mia", "ABBA"], ["Billie Jean", "Michael Jackson"], ["Celebration", "Kool & the Gang"],
      ["Get Lucky", "Daft Punk"], ["Treasure", "Bruno Mars"], ["24K Magic", "Bruno Mars"],
      ["Blinding Lights", "The Weeknd"], ["Levitating", "Dua Lipa"], ["Wake Me Up", "Avicii"],
      ["Levels", "Avicii"], ["Sweet Caroline", "Neil Diamond"], ["Don't Stop Believin'", "Journey"],
      ["Livin' On A Prayer", "Bon Jovi"], ["Mr. Brightside", "The Killers"],
      ["Take Me Home, Country Roads", "John Denver"], ["Brown Eyed Girl", "Van Morrison"],
      ["Build Me Up Buttercup", "The Foundations"], ["Proud Mary", "Creedence Clearwater Revival"],
      ["Play That Funky Music", "Wild Cherry"], ["Twist and Shout", "The Beatles"],
      ["I Want You Back", "The Jackson 5"], ["ABC", "The Jackson 5"], ["Footloose", "Kenny Loggins"],
      ["Summer of '69", "Bryan Adams"], ["Walking on Sunshine", "Katrina and the Waves"],
      ["Girls Just Want to Have Fun", "Cyndi Lauper"], ["I'm Gonna Be (500 Miles)", "The Proclaimers"],
      ["Come On Eileen", "Dexys Midnight Runners"], ["YMCA", "Village People"],
      ["Cupid Shuffle", "Cupid"], ["Cha Cha Slide", "DJ Casper"], ["Macarena", "Los Del Rio"],
      ["We Are Family", "Sister Sledge"], ["Shout", "The Isley Brothers"], ["Dance, Dance", "Fall Out Boy"],
      ["You Make My Dreams", "Hall & Oates"], ["Kiss", "Prince"], ["Uptown Girl", "Billy Joel"],
      ["Dancing in the Dark", "Bruce Springsteen"], ["Born to Run", "Bruce Springsteen"],
      ["Thunder Road", "Bruce Springsteen"], ["Sweet Home Alabama", "Lynyrd Skynyrd"],
      ["Piano Man", "Billy Joel"], ["American Pie", "Don McLean"], ["Hey Jude", "The Beatles"],
      ["Viva La Vida", "Coldplay"], ["I Want It That Way", "Backstreet Boys"],
      ["Wannabe", "Spice Girls"], ["Toxic", "Britney Spears"], ["Since U Been Gone", "Kelly Clarkson"],
      ["Call Me Maybe", "Carly Rae Jepsen"], ["Shake It Off", "Taylor Swift"],
      ["Blank Space", "Taylor Swift"], ["Can't Feel My Face", "The Weeknd"],
      ["Locked Out of Heaven", "Bruno Mars"], ["Take On Me", "a-ha"],
      ["Wake Me Up Before You Go-Go", "Wham!"], ["Despacito", "Luis Fonsi"],
      ["Livin' la Vida Loca", "Ricky Martin"], ["Gangnam Style (강남스타일)", "PSY"],
      ["I'm Yours","Jason Mraz"],
      ["Just the Way You Are","Bruno Mars"],
      ["What a Wonderful World","Louis Armstrong"],
      ["Over the Rainbow","Israel Kamakawiwo'ole"],
      ["Photograph","Ed Sheeran"],
      ["Galway Girl","Ed Sheeran"],
      ["Say You Won't Let Go","James Arthur"],
      ["Shallow","Lady Gaga"],
      ["Someone Like You","Adele"],
      ["Budapest","George Ezra"],
      ["Count on Me","Bruno Mars"],
      ["Rolling in the Deep","Adele"]
    ]
  },
  {
    id: "party",
    name: "Party & Functions Pack",
    tagline: "High-energy floor-fillers for birthdays, functions and club nights — zero slow songs.",
    price: 9.99,
    vibes: ["Warm-up bangers", "Peak-time floor-fillers", "Last-call singalongs"],
    songs: [
      ["Uptown Funk", "Mark Ronson"], ["Blinding Lights", "The Weeknd"], ["I Gotta Feeling", "The Black Eyed Peas"],
      ["Get Lucky", "Daft Punk"], ["Shut Up and Dance", "Walk the Moon"], ["Mr. Brightside", "The Killers"],
      ["Don't Stop Believin'", "Journey"], ["Livin' On A Prayer", "Bon Jovi"], ["Sweet Caroline", "Neil Diamond"],
      ["Dancing Queen", "ABBA"], ["Mamma Mia", "ABBA"], ["September", "Earth, Wind & Fire"],
      ["Billie Jean", "Michael Jackson"], ["Uptown Girl", "Billy Joel"], ["Piano Man", "Billy Joel"],
      ["Dancing in the Dark", "Bruce Springsteen"], ["Born to Run", "Bruce Springsteen"],
      ["Summer of '69", "Bryan Adams"], ["Footloose", "Kenny Loggins"],
      ["You Shook Me All Night Long", "AC/DC"], ["Back in Black", "AC/DC"], ["Highway to Hell", "AC/DC"],
      ["We Will Rock You", "Queen"], ["Another One Bites the Dust", "Queen"],
      ["Don't Stop Me Now", "Queen"], ["I Want It That Way", "Backstreet Boys"],
      ["Wannabe", "Spice Girls"], ["Toxic", "Britney Spears"], ["...Baby One More Time", "Britney Spears"],
      ["Since U Been Gone", "Kelly Clarkson"], ["Party Rock Anthem", "LMFAO"],
      ["Call Me Maybe", "Carly Rae Jepsen"], ["Shake It Off", "Taylor Swift"],
      ["Blank Space", "Taylor Swift"], ["Can't Feel My Face", "The Weeknd"],
      ["24K Magic", "Bruno Mars"], ["Treasure", "Bruno Mars"], ["Locked Out of Heaven", "Bruno Mars"],
      ["Take On Me", "a-ha"], ["Wake Me Up Before You Go-Go", "Wham!"],
      ["I'm Gonna Be (500 Miles)", "The Proclaimers"], ["Come On Eileen", "Dexys Midnight Runners"],
      ["Walking on Sunshine", "Katrina and the Waves"], ["Happy", "Pharrell Williams"],
      ["Can't Stop the Feeling!", "Justin Timberlake"], ["Despacito", "Luis Fonsi"],
      ["Livin' la Vida Loca", "Ricky Martin"], ["Mambo No. 5", "Lou Bega"],
      ["Gangnam Style", "PSY"], ["Macarena", "Los Del Rio"], ["Cupid Shuffle", "Cupid"],
      ["Cha Cha Slide", "DJ Casper"], ["YMCA", "Village People"], ["We Are Family", "Sister Sledge"],
      ["Celebration", "Kool & the Gang"], ["Love Shack", "The B-52s"], ["Play That Funky Music", "Wild Cherry"],
      ["Twist and Shout", "The Beatles"], ["I Want You Back", "The Jackson 5"], ["ABC", "The Jackson 5"],
      ["Girls Just Want to Have Fun", "Cyndi Lauper"], ["Kiss", "Prince"],
      ["You Make My Dreams", "Hall & Oates"], ["Proud Mary", "Creedence Clearwater Revival"],
      ["Sweet Home Alabama", "Lynyrd Skynyrd"], ["Brown Eyed Girl", "Van Morrison"],
      ["American Pie", "Don McLean"], ["Hey Jude", "The Beatles"], ["Viva La Vida", "Coldplay"],
      ["Wonderwall", "Oasis"], ["Champagne Supernova", "Oasis"], ["Take Me Home, Country Roads", "John Denver"],
      ["Wagon Wheel", "Old Crow Medicine Show"], ["Levitating", "Dua Lipa"], ["Wake Me Up", "Avicii"],
      ["Levels", "Avicii"], ["Shape of You", "Ed Sheeran"], ["Bad Guy", "Billie Eilish"],
      ["Old Town Road", "Lil Nas X"], ["Sunflower", "Post Malone"], ["Circles", "Post Malone"],
      ["Save Your Tears", "The Weeknd"], ["In Da Club", "50 Cent"], ["Crank That (Soulja Boy)", "Soulja Boy"],
      ["Yeah!", "Usher"], ["Low", "Flo Rida"], ["Get Low", "Lil Jon"], ["Turn Down for What", "DJ Snake"],
      ["Timber", "Pitbull"], ["Fireball", "Pitbull"], ["Give Me Everything", "Pitbull"],
      ["Danza Kuduro", "Don Omar"], ["Waka Waka (This Time for Africa)", "Shakira"],
      ["Hips Don't Lie", "Shakira"], ["Dance Monkey", "Tones and I"], ["Bad Romance", "Lady Gaga"],
      ["Just Dance", "Lady Gaga"], ["Poker Face", "Lady Gaga"], ["Umbrella", "Rihanna"],
      ["We Found Love", "Rihanna"], ["Only Girl (In the World)", "Rihanna"], ["DJ Got Us Fallin' in Love", "Usher"],
      ["Hotline Bling","Drake"],
      ["One Dance","Drake"],
      ["God's Plan","Drake"],
      ["Don't Start Now","Dua Lipa"],
      ["Physical","Dua Lipa"],
      ["Cold Heart","Elton John"],
      ["The Middle","Zedd"],
      ["Closer","The Chainsmokers"],
      ["Roar","Katy Perry"],
      ["Firework","Katy Perry"],
      ["Dynamite","BTS"],
      ["Butter","BTS"],
      ["DDU-DU DDU-DU","BLACKPINK"]
    ]
  },
  {
    id: "country",
    name: "Country Night Pack",
    tagline: "Three sets of singalong country — classic to modern, tailgate to dancehall.",
    price: 9.99,
    vibes: ["Classics & slow ones", "Mid-tempo singalongs", "High-energy dancehall"],
    songs: [
      ["Take Me Home, Country Roads", "John Denver"], ["Friends in Low Places", "Garth Brooks"],
      ["The Gambler", "Kenny Rogers"], ["Islands in the Stream", "Kenny Rogers"],
      ["9 to 5", "Dolly Parton"], ["Jolene", "Dolly Parton"], ["I Will Always Love You", "Dolly Parton"],
      ["Ring of Fire", "Johnny Cash"], ["Folsom Prison Blues", "Johnny Cash"],
      ["I Walk the Line", "Johnny Cash"], ["Sweet Home Alabama", "Lynyrd Skynyrd"],
      ["Simple Man", "Lynyrd Skynyrd"], ["Free Bird", "Lynyrd Skynyrd"],
      ["Wagon Wheel", "Old Crow Medicine Show"], ["Ho Hey", "The Lumineers"],
      ["House of the Rising Sun", "The Animals"], ["The Weight", "The Band"],
      ["Achy Breaky Heart", "Billy Ray Cyrus"], ["Man! I Feel Like a Woman!", "Shania Twain"],
      ["Any Man of Mine", "Shania Twain"], ["That Don't Impress Me Much", "Shania Twain"],
      ["Chicken Fried", "Zac Brown Band"], ["Toes", "Zac Brown Band"], ["Free", "Zac Brown Band"],
      ["Whatever It Is", "Zac Brown Band"], ["Keep Me in Mind", "Zac Brown Band"],
      ["Sweet Annie", "Zac Brown Band"], ["Homegrown", "Zac Brown Band"],
      ["Dirt Road Anthem", "Jason Aldean"], ["She's Country", "Jason Aldean"],
      ["My Kinda Party", "Jason Aldean"], ["Cruise", "Florida Georgia Line"],
      ["Dirt", "Florida Georgia Line"], ["Sun Daze", "Florida Georgia Line"],
      ["Round Here", "Florida Georgia Line"], ["This Is How We Roll", "Florida Georgia Line"],
      ["Drunk on a Plane", "Dierks Bentley"], ["Sideways", "Dierks Bentley"],
      ["Come a Little Closer", "Dierks Bentley"], ["Somewhere on a Beach", "Dierks Bentley"],
      ["I Hold On", "Dierks Bentley"], ["Free and Easy (Down the Road I Go)", "Dierks Bentley"],
      ["What Was I Thinkin'", "Dierks Bentley"], ["Country Girl (Shake It for Me)", "Luke Bryan"],
      ["Play It Again", "Luke Bryan"], ["That's My Kind of Night", "Luke Bryan"],
      ["Drink in My Hand", "Eric Church"], ["Springsteen", "Eric Church"],
      ["Barefoot Blue Jean Night", "Jake Owen"], ["Pontoon", "Little Big Town"],
      ["Boondocks", "Little Big Town"], ["Better Dig Two", "The Band Perry"],
      ["If I Die Young", "The Band Perry"], ["Need You Now", "Lady Antebellum"],
      ["Lady A", "Lady A"], ["The House That Built Me", "Miranda Lambert"],
      ["Gunpowder & Lead", "Miranda Lambert"], ["Before He Cheats", "Carrie Underwood"],
      ["Jesus, Take the Wheel", "Carrie Underwood"], ["Cowboy Casanova", "Carrie Underwood"],
      ["All-American Girl", "Carrie Underwood"], ["American Honey", "Lady Antebellum"],
      ["Bartender", "Lady Antebellum"], ["Humble and Kind", "Tim McGraw"],
      ["Live Like You Were Dying", "Tim McGraw"], ["Highway Don't Care", "Tim McGraw"],
      ["Amazed", "Lonestar"], ["Bless the Broken Road", "Rascal Flatts"],
      ["Life Is a Highway", "Rascal Flatts"], ["My Wish", "Rascal Flatts"],
      ["Here for the Party", "Gretchen Wilson"], ["Redneck Woman", "Gretchen Wilson"],
      ["Save a Horse (Ride a Cowboy)", "Big & Rich"], ["Watching You", "Rodney Atkins"],
      ["These Are the Days", "Zac Brown Band"], ["Colder Weather", "Zac Brown Band"],
      ["Knee Deep", "Zac Brown Band"], ["The Night the Lights Went Out in Georgia", "Reba McEntire"],
      ["Fancy", "Reba McEntire"], ["The Thunder Rolls", "Garth Brooks"],
      ["If Tomorrow Never Comes", "Garth Brooks"], ["Much Too Young", "Garth Brooks"],
      ["The Dance", "Garth Brooks"], ["Amarillo by Morning", "George Strait"],
      ["Check Yes or No", "George Strait"], ["The Chair", "George Strait"],
      ["Chattahoochee", "Alan Jackson"], ["Remember When", "Alan Jackson"],
      ["Where Were You (When the World Stopped Turning)", "Alan Jackson"], ["Drive (For Daddy Gene)", "Alan Jackson"],
      ["It's Five O'Clock Somewhere", "Alan Jackson"], ["Good Directions", "Billy Currington"],
      ["People Are Crazy", "Billy Currington"], ["That's How Country Boys Roll", "Billy Currington"],
      ["She Thinks My Tractor's Sexy", "Kenny Chesney"], ["When the Sun Goes Down", "Kenny Chesney"],
      ["No Shoes, No Shirt, No Problems", "Kenny Chesney"], ["The Good Stuff", "Kenny Chesney"],
      ["You're Still the One", "Shania Twain"], ["Whiskey Lullaby", "Brad Paisley"],
      ["Letter to Me", "Brad Paisley"], ["Online", "Brad Paisley"],
      ["Rain Is a Good Thing","Luke Bryan"],
      ["Kick the Dust Up","Luke Bryan"],
      ["Crash My Party","Luke Bryan"],
      ["Drink a Beer","Luke Bryan"],
      ["Smoke a Little Smoke","Eric Church"],
      ["Like a Wrecking Ball","Eric Church"],
      ["Talladega","Eric Church"],
      ["Record Year","Eric Church"],
      ["Beachin'","Jake Owen"],
      ["Day Drinking","Little Big Town"],
      ["Girl Crush","Little Big Town"],
      ["Tornado","Little Big Town"],
      ["Something Like That","Tim McGraw"],
      ["Just to See You Smile","Tim McGraw"],
      ["Shotgun Rider","Tim McGraw"],
      ["All My Ex's Live in Texas","George Strait"],
      ["The Fireman","George Strait"],
      ["Livin' on Love","Alan Jackson"],
      ["Gone Country","Alan Jackson"],
      ["Mud on the Tires","Brad Paisley"],
      ["Ticks","Brad Paisley"],
      ["She's Everything","Brad Paisley"],
      ["Blown Away","Carrie Underwood"],
      ["Good Girl","Carrie Underwood"],
      ["Mama's Broken Heart","Miranda Lambert"],
      ["White Liar","Miranda Lambert"],
      ["Automatic","Miranda Lambert"],
      ["5-1-5-0","Dierks Bentley"],
      ["Am I the Only One","Dierks Bentley"],
      ["Riser","Dierks Bentley"],
      ["H.O.L.Y.","Florida Georgia Line"],
      ["Sippin' on Fire","Florida Georgia Line"],
      ["Goodbye in Her Eyes","Zac Brown Band"],
      ["Jump Right In","Zac Brown Band"],
      ["Castaway","Zac Brown Band"],
      ["On the Road Again","Willie Nelson"],
      ["Don't Take the Girl","Tim McGraw"],
      ["The Devil Went Down to Georgia","Charlie Daniels Band"],
      ["Fishin' in the Dark","Nitty Gritty Dirt Band"],
      ["Guitars, Cadillacs","Dwight Yoakam"],
      ["I'm Gonna Miss Her","Brad Paisley"],
      ["Alcohol","Brad Paisley"],
      ["Two Black Cadillacs","Carrie Underwood"],
      ["Undo It","Carrie Underwood"],
      ["Last Name","Carrie Underwood"],
      ["Mammas Don't Let Your Babies Grow Up to Be Cowboys","Willie Nelson"]
    ]
  }
];

PACKS.push(...require("./packs-extra.js"));
PACKS.forEach(buildPack);
