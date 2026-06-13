const words = [

"Volvo",
"Fotboll",
"Pizza",
"Stockholm",
"Kamel",

"كرة قدم",
"سيارة",
"بيت",
"موبايل",
"قهوة",

"Falafel",
"Kebab",
"Göteborg",
"Malmö",
"Snö"

];

let totalPlayers = 0;
let currentPlayer = 1;
let imposter = 0;
let secretWord = "";

function startGame(){

totalPlayers =
parseInt(document.getElementById("players").value);

if(totalPlayers < 3){
alert("Minimum 3 players");
return;
}

currentPlayer = 1;

imposter =
Math.floor(Math.random()*totalPlayers)+1;

secretWord =
words[Math.floor(Math.random()*words.length)];

showPlayer();
}

function showPlayer(){

const game = document.getElementById("game");

if(currentPlayer > totalPlayers){

game.innerHTML = `
<div class="card">
<h2>🗣️ Discussion Time</h2>
<p>ناقشوا الكلمة وابحثوا عن الدخيل</p>

<button class="success"
onclick="startGame()">
🔄 New Round
</button>
</div>
`;

return;
}

game.innerHTML = `
<div class="card">
<h2>Player ${currentPlayer}</h2>

<h3>اللاعب ${currentPlayer}</h3>

<button class="primary"
onclick="revealRole()">
Reveal / كشف
</button>
</div>
`;
}

function revealRole(){

const game = document.getElementById("game");

let text;

if(currentPlayer === imposter){

text = `
<h2>🕵️ IMPOSTER</h2>
<h3>أنت الدخيل</h3>
`;

}else{

text = `
<h2>✅ ${secretWord}</h2>
<h3>الكلمة السرية</h3>
`;
}

game.innerHTML = `
<div class="card">
${text}

<button class="success"
onclick="nextPlayer()">
Next Player
اللاعب التالي
</button>
</div>
`;
}

function nextPlayer(){
currentPlayer++;
showPlayer();
}