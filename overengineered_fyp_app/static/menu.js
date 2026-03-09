// -----------------------------
// Load leaderboard usernames
// -----------------------------
let leaderboardData = []

async function loadLeaderboard(){
    try{
        const res = await fetch("/leaderboard")
        leaderboardData = await res.json()
    }catch(err){
        console.log("Could not load leaderboard:", err)
    }
}

loadLeaderboard()


// -----------------------------
// Duplicate ID check
// -----------------------------
form.addEventListener("submit", function(event){

    const usernameInput = document.getElementById("usernameInput")
    const usernameError = document.getElementById("usernameError")

    const username = usernameInput.value.trim()

    usernameError.innerText = ""

    if(leaderboardData.some(p => p.username.toLowerCase() === username.toLowerCase())){
        usernameError.innerText = "This Participant ID is already used"
        event.preventDefault()
        return
    }

})


// -----------------------------
// Clear error while typing
// -----------------------------
document.getElementById("usernameInput").addEventListener("input", () => {
    document.getElementById("usernameError").innerText = ""
})