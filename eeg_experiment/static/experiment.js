const BASELINE_TIME = 5000
const PATTERN_TIME = 5000
const REPEATS = 1

const RESPONSE_WINDOW = 2000
// const MIN_DELAY = 2500
// const MAX_DELAY = 5000
const MIN_DELAY = 500
const MAX_DELAY = 1000
const COOLDOWN = 2500

const status = document.getElementById("status")
const fixation = document.getElementById("fixation")
const breakScreen = document.getElementById("break")
const breakText = document.getElementById("breakText")
const miniBoard = document.getElementById("miniBoard")
let waitingForBreak = false
let experiment = {
    username: null,
    timestamp: null,
    bestRT: null,
    allRTs: [],
    trials: []
}
let lastKeyTime = 0
let cooldownUntil = 0
const KEY_COOLDOWN = 250
const MIN_VALID_RT = 120
let currentTrialData = null
let currentBlockData = null

let waitingForResponse = false
let stimStart = 0
let resetStimulusTimer = false

let currentBlock = "Waiting"
let currentTrial = 0
let currentPattern = "-"
const PATTERNS = PATTERN_ORDER.map(Number)
let username = USERNAME
let allRTs = []
function updateMiniBoard(){

    const bestRT = allRTs.length ? Math.min(...allRTs) : null
    const board = JSON.parse(sessionStorage.getItem("leaderboard") || "[]")

    let text = "<b>Leaderboard</b><br>"

    let displayBoard = [...board]

    if(bestRT){
        displayBoard.push({
            username: "You",
            best_rt: bestRT
        })
    }

    displayBoard.sort((a,b)=>a.best_rt-b.best_rt)

    displayBoard.slice(0,10).forEach((p,i)=>{
        text += `${i+1}. ${p.username} — ${p.best_rt.toFixed(3)} ms<br>`
    })

    miniBoard.innerHTML = text
}
function setPattern(n){
    window.postMessage({
        type: "SET_PATTERN",
        pattern: n
    }, "*")
}

function startPattern(){
    window.postMessage({
        type: "START_PATTERN"
    }, "*")
}

function stopPattern(){
    window.postMessage({
        type: "STOP_PATTERN"
    }, "*")
}
async function loadLeaderboard(){
    const res = await fetch("/leaderboard")
    const board = await res.json()

    sessionStorage.setItem("leaderboard", JSON.stringify(board))
    updateMiniBoard()

    console.log("Leaderboard loaded:", board)
}
async function breakScreenWait(label){

    const bestRT = allRTs.length ? Math.min(...allRTs) : null

    console.log("Break reached")
    console.log("All RTs:", allRTs)
    console.log("Best RT so far:", bestRT)

    stopPattern()
    log("break_start",{label})

    fixation.style.display = "none"
    breakScreen.style.display = "block"
    updateMiniBoard()
    miniBoard.style.display = "block"
    const board = JSON.parse(sessionStorage.getItem("leaderboard") || "[]")
    updateMiniBoard()

    // First screen = instructions
    if(label === "start"){
        breakText.innerHTML = `
        Instructions<br><br>
        Fixate on the cross.<br>
        Press SPACE when it shrinks to bring it back to normal size.<br><br>
        Press SPACE to start
        `
    }
    else{
        breakText.innerHTML = `
            Break<br><br>
            Take a moment to rest.<br>
            Press SPACE to continue
            `
    }

    waitingForBreak = true

    while(waitingForBreak){
        await sleep(100)
    }

    breakScreen.style.display = "none"
    fixation.style.display = "block"
    miniBoard.style.display = "none"

    log("break_end",{label})
}
function updateStatus(){
    status.innerText =
`${currentBlock} | Pattern ${currentPattern} | Trial ${currentTrial}/${REPEATS} | ${username}`
}

function sleep(ms){
    return new Promise(r => setTimeout(r,ms))
}

function rand(min,max){
    return Math.random()*(max-min)+min
}

function log(type,data={}){

    if(!currentBlockData) return

    currentBlockData.events.push({
        type,
        time: performance.now(),
        ...data
    })
}

document.addEventListener("keydown",(e)=>{

    if(e.code !== "Space") return
    if(e.repeat) return

    const now = performance.now()

    // spam protection
    if(now < cooldownUntil){
        fixation.innerText = "Too soon!"
        resetStimulusTimer = true
        setTimeout(()=>{ fixation.innerText="+" },400)
        return
    }

    cooldownUntil = now + KEY_COOLDOWN
    lastKeyTime = now

    // Break screen
    if(waitingForBreak){
        waitingForBreak = false
        breakScreen.style.display = "none"
        fixation.style.display = "block"
        return
    }

    // Correct response
    if(waitingForResponse){

        waitingForResponse = false

        const rt = performance.now() - stimStart

        fixation.innerText = "+"

        allRTs.push(rt)

        console.log("RT:", rt)
        console.log("All RTs so far:", allRTs)

        log("hit",{rt})

        return
    }

    // FALSE PRESS (pressed when no stimulus)
    fixation.innerText = "Too soon!"

    log("false_hit")

    setTimeout(()=>{
        fixation.innerText = "+"
    },400)

})


async function runStimulus(){

    fixation.innerText="."

    stimStart = performance.now()

    waitingForResponse = true

    log("stimulus_on")

    await sleep(RESPONSE_WINDOW)

    if(waitingForResponse){

        waitingForResponse=false

        fixation.innerText="+"

        log("miss")

    }

}

async function runReactionBlock(duration){

    const start = performance.now()

    while(performance.now()-start < duration){

        let delay = rand(MIN_DELAY,MAX_DELAY)
        let startDelay = performance.now()

        while(performance.now() - startDelay < delay){

            if(resetStimulusTimer){
                resetStimulusTimer = false
                delay = rand(MIN_DELAY,MAX_DELAY)
                startDelay = performance.now()
            }

            await sleep(10)
        }

        // wait if user recently spammed
        while(performance.now() < cooldownUntil){
            await sleep(20)
        }

        if(performance.now()-start >= duration) break

        await runStimulus()

        await sleep(COOLDOWN)
    }
}

async function baseline(i){
    stopPattern()
    currentBlock = "Baseline"
    currentTrial = i
    updateStatus()

    fixation.innerText="+"

    currentBlockData = {
        start: performance.now(),
        end: null,
        events: []
    }

    currentTrialData.baseline = currentBlockData

    await runReactionBlock(BASELINE_TIME)

    currentBlockData.end = performance.now()

}

async function pattern(i){

    currentBlock = "Pattern"
    currentTrial = i
    updateStatus()

    fixation.innerText="+"

    currentBlockData = {
        start: performance.now(),
        end: null,
        events: []
    }

    currentTrialData.pattern_block = currentBlockData
    startPattern() 
    await runReactionBlock(PATTERN_TIME)

    currentBlockData.end = performance.now()

}

async function run(){
    await loadLeaderboard()
    updateStatus()
    experiment.username = username
    experiment.timestamp = performance.now()
    await breakScreenWait("start")

    for(let p=0; p<PATTERNS.length; p++){

        const patternNumber = PATTERNS[p]
        currentPattern = patternNumber
        updateStatus()

        console.log("Starting pattern", patternNumber)

        setPattern(patternNumber)

        for(let i=1;i<=REPEATS;i++){

            currentTrialData = {
                pattern: patternNumber,
                trial: i,
                baseline: null,
                pattern_block: null
            }

            experiment.trials.push(currentTrialData)

            await baseline(i)

            await breakScreenWait("baseline_to_pattern")

            await pattern(i)

            if(i < REPEATS){
                await breakScreenWait("trial_break")
            }

        }

    }
    stopPattern()
    const bestRT = allRTs.length ? Math.min(...allRTs) : null

    console.log("Experiment finished")
    console.log("All RTs:", allRTs)
    console.log("Best RT overall:", bestRT)
    status.innerText="Saving..."
    experiment.allRTs = allRTs
    experiment.bestRT = bestRT

    const res = await fetch("/save",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(experiment)
    })
    const leaderboard = await res.json()

    sessionStorage.setItem("leaderboard", JSON.stringify(leaderboard))


    status.innerText="Experiment complete"

}
run()