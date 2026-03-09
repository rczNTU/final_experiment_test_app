import { showSticker, showMascot, clearAlerts } from "./alerts.js"
const BASELINE_TIME = 21000
const PATTERN_TIME = 21000
const REPEATS = 10

const RESPONSE_WINDOW = 2000
const MIN_DELAY = 2500
const MAX_DELAY = 3500
// const MIN_DELAY = 500
// const MAX_DELAY = 1000
const COOLDOWN = 2500
let falsePressCount = 0
const FALSE_PRESS_PENALTY = 200 // ms added to average per false press

const status = document.getElementById("status")
const fixation = document.getElementById("fixation")
const breakScreen = document.getElementById("break")
const breakText = document.getElementById("breakText")
const miniBoard = document.getElementById("miniBoard")
const rtGraph = document.getElementById("rtGraph")
const feedback = document.getElementById("feedback")
const rtCtx = rtGraph.getContext("2d")
const tooltip = document.getElementById("rtTooltip")
const mascot = document.getElementById("mascot")

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
let clickMeta = []
let previousAvgRT = null
let lastRTCount = 0
function randomStimCount(){
    return Math.random() < 0.5 ? 2 : 3
}
rtGraph.addEventListener("mousemove",(e)=>{

    if(allRTs.length === 0) return

    const rect = rtGraph.getBoundingClientRect()

    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const barWidth = 6
    const gap = 3
    const padding = 5

    const visibleBars = Math.floor((rtGraph.width-padding*2)/(barWidth+gap))
    const rts = allRTs.slice(-visibleBars)

    const index = Math.floor((mouseX-padding)/(barWidth+gap))

    if(index >= 0 && index < rts.length){

        const meta = clickMeta[allRTs.length - rts.length + index]
        const rt = meta.rt

        tooltip.style.display = "block"

        tooltip.style.left = e.clientX + 10 + "px"
        tooltip.style.top = e.clientY - 20 + "px"

        tooltip.innerHTML =
        `${meta.block} | Trial ${meta.trial}<br>${rt.toFixed(1)} ms`

    }else{

        tooltip.style.display = "none"

    }

})

rtGraph.addEventListener("mouseleave",()=>{

    tooltip.style.display = "none"

})
function showCompletionScreen(){

    status.innerText = "Experiment Complete"

    fixation.style.display = "none"

    // SHOW stats
    miniBoard.style.display = "block"
    rtGraph.style.display = "block"

    // feedback not needed anymore
    feedback.style.display = "none"

    breakScreen.style.display = "block"

    const bestRT = allRTs.length ? Math.min(...allRTs) : null
    const avgRT = getAverageRT()

    // update leaderboard + graph one final time
    updateMiniBoard()
    drawRTGraph()

    breakText.innerHTML = `
        <h2>Experiment Complete</h2><br>

        Thank you for participating.<br><br>

        <b>Your fastest reaction:</b> ${bestRT ? bestRT.toFixed(1) : "-"} ms<br>
        <b>Your average reaction:</b> ${avgRT ? avgRT.toFixed(1) : "-"} ms<br><br>

        <b>False presses:</b> ${falsePressCount}<br><br>

        <div style="display:flex; justify-content:center; align-items:center; gap:100px;">

            <div>
                <b>Feedback Survey</b><br>
                <img src="./static/qr_codes_fyp/survey_qr.png" width="260">
            </div>

            <div>
                <b>Compensation Form</b><br>
                <img src="./static/qr_codes_fyp/compensation_qr.png" width="260">
            </div>

        </div>
        `
}
function updateFeedback(oldAvg, newAvg){

    const diff = newAvg - oldAvg
    const el = document.getElementById("feedback")

    if(Math.abs(diff) < 5){
        el.innerHTML = "Reaction time stable"
        el.className = "feedback-neutral"
    }

    else if(diff < 0){
        el.innerHTML = `Faster by ${Math.abs(diff).toFixed(1)} ms`
        el.className = "feedback-good"
    }

    else{
        el.innerHTML = `Slower by ${diff.toFixed(1)} ms`
        el.className = "feedback-bad"
    }

}
function getAverageRT(){
    if(allRTs.length === 0) return null

    const sum = allRTs.reduce((a,b)=>a+b,0)

    let avg = sum / allRTs.length

    // // apply penalty
    // avg += falsePressCount * FALSE_PRESS_PENALTY

    return avg
}
function drawRTGraph(){

    const w = rtGraph.width
    const h = rtGraph.height

    rtCtx.clearRect(0,0,w,h)

    if(allRTs.length === 0) return

    const maxRT = 600
    const barWidth = 6
    const gap = 3
    const padding = 5

    const visibleBars = Math.floor((w-padding*2)/(barWidth+gap))

    const rts = allRTs.slice(-visibleBars)

    rts.forEach((rt,i)=>{

        const normalized = Math.min(rt/maxRT,1)

        const barHeight = normalized*(h-padding*2)

        const x = padding + i*(barWidth+gap)
        const y = h-padding-barHeight

        rtCtx.fillStyle = "lime"

        rtCtx.fillRect(x,y,barWidth,barHeight)

    })
}

function updateMiniBoard(){

    const bestRT = allRTs.length ? Math.min(...allRTs) : null
    const avgRT = getAverageRT()

    const board = JSON.parse(sessionStorage.getItem("leaderboard") || "[]")

    let text = "<b>Fastest reflex</b><br>"

    let displayBoard = [...board]

    if(bestRT){
        displayBoard.push({
            username: "You",
            best_rt: bestRT,
            avg_rt: avgRT
        })
    }

    // ------------------------
    // Ensure avg_rt exists
    // ------------------------

    displayBoard.forEach(p=>{
        if(p.avg_rt === undefined || p.avg_rt === null){
            p.avg_rt = p.best_rt
        }
    })

    // ------------------------
    // FASTEST REFLEX
    // ------------------------

    const fastest = [...displayBoard]
        .sort((a,b)=>a.best_rt-b.best_rt)
        .slice(0,30)

    fastest.forEach((p,i)=>{
        text += `${i+1}. ${p.username} — ${p.best_rt.toFixed(1)} ms<br>`
    })

    text += "<br><b>Leaderboard</b><br>"

    // ------------------------
    // CONSISTENCY LEADERBOARD
    // ------------------------

    const consistent = [...displayBoard]
        .sort((a,b)=>a.avg_rt-b.avg_rt)
        .slice(0,30)

    consistent.forEach((p,i)=>{
        text += `${i+1}. ${p.username} — ${p.avg_rt.toFixed(1)} ms<br>`
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
async function trialBarrier(nextBlock){
    const halfway = Math.ceil(REPEATS / 2)
    const isHalfway = currentTrial === halfway
    const isFinal = currentTrial === REPEATS
    stopPattern()

    fixation.style.display = "none"
    breakScreen.style.display = "block"
    miniBoard.style.display = "block"
    rtGraph.style.display = "block"
    feedback.style.display = "block"
    updateMiniBoard()
    drawRTGraph()
    const avg = getAverageRT()

    if(allRTs.length > lastRTCount){
        if(previousAvgRT !== null && avg !== null){
            updateFeedback(previousAvgRT, avg)
        }

        previousAvgRT = avg
        lastRTCount = allRTs.length
    }

    let label = ""

    if(nextBlock === "baseline"){
        label = `Next: Baseline`
    }

    if(nextBlock === "pattern"){

        if(isFinal){
            label = `<span style="font-size:40px;color:gold;">FINAL one! ⚡</span><br><br>Pattern ${currentPattern}`
        }

        else if(isHalfway){
            // showSticker("🎉 HALFWAY!")
            showMascot({
                textTop: "Halfway there!",
                textBottom: "Here's a cute bear",
                duration: 9000,
                x: "90%",
                y: "90%"
            })
            label = `Next: Pattern ${currentPattern}`
        }

        else{
            label = `Next: Pattern ${currentPattern}`
        }

    }

    breakText.innerHTML = `
        ${label}<br><br>
        Trial ${currentTrial} / ${REPEATS}<br><br>
        Press ENTER to continue
    `

    waitingForBreak = true

    while(waitingForBreak){
        await sleep(100)
    }
    clearAlerts() 
    breakScreen.style.display = "none"
    miniBoard.style.display = "none"
    rtGraph.style.display = "none"
    feedback.style.display = "none"
    fixation.style.display = "block"
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
    feedback.style.display = "block"
    updateMiniBoard()
    miniBoard.style.display = "block"
    rtGraph.style.display = "block"
    const board = JSON.parse(sessionStorage.getItem("leaderboard") || "[]")
    updateMiniBoard()
    drawRTGraph()

    const avg = getAverageRT()

    if(allRTs.length > lastRTCount){
        if(previousAvgRT !== null && avg !== null){
            updateFeedback(previousAvgRT, avg)
        }

        previousAvgRT = avg
        lastRTCount = allRTs.length
    }

    // First screen = instructions
    if(label === "start"){
        breakText.innerHTML = `
        Instructions<br><br>
        Fixate on the cross.<br>
        Press SPACE when you see a red square to bring it back to a cross.<br><br>
        Press ENTER to start
        `
    }
    else{
        breakText.innerHTML = `
            Break<br><br>
            Take a moment to rest.<br>
            Press ENTER to continue
            `
    }

    waitingForBreak = true

    while(waitingForBreak){
        await sleep(100)
    }
    clearAlerts() 
    breakScreen.style.display = "none"
    miniBoard.style.display = "none"
    rtGraph.style.display = "none"
    feedback.style.display = "none"

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

    if(e.repeat) return

    const now = performance.now()

    // ---------------------------
    // ENTER = start / continue
    // ---------------------------
    if(e.code === "Enter"){

            if(waitingForBreak){
                waitingForBreak = false
            }

            return
        }

    // ---------------------------
    // SPACE = reaction response
    // ---------------------------
    if(e.code !== "Space") return

    // spam protection
    if(now < cooldownUntil){
        fixation.innerText = "Too soon!"
        resetStimulusTimer = true
        setTimeout(()=>{ fixation.innerText="+" },400)
        return
    }

    cooldownUntil = now + KEY_COOLDOWN
    lastKeyTime = now

    // Correct response
    if(waitingForResponse){

        waitingForResponse = false

        const rt = performance.now() - stimStart

        fixation.innerText = "+"

        allRTs.push(rt)
        clickMeta.push({
            rt: rt,
            trial: currentTrial,
            block: currentBlock,
            pattern: currentPattern
        })
        console.log("RT:", rt)
        console.log("All RTs so far:", allRTs)

        log("hit",{rt})

        return
    }

    // FALSE PRESS
    fixation.innerText = "Too soon!"

    falsePressCount++

    console.log("False presses:", falsePressCount)

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

    const blockStart = performance.now()
    const blockEnd = blockStart + duration

    let stimCount = 0

    while(performance.now() < blockEnd){

        let delay = rand(MIN_DELAY, MAX_DELAY)
        let startDelay = performance.now()

        while(performance.now() - startDelay < delay){

            if(resetStimulusTimer){
                resetStimulusTimer = false
                delay = rand(MIN_DELAY, MAX_DELAY)
                startDelay = performance.now()
            }

            if(performance.now() >= blockEnd) break
            await sleep(10)
        }

        while(performance.now() < cooldownUntil){
            if(performance.now() >= blockEnd) break
            await sleep(20)
        }

        if(performance.now() + RESPONSE_WINDOW > blockEnd) break

        await runStimulus()
        stimCount++

        if(performance.now() + COOLDOWN > blockEnd) break
        await sleep(COOLDOWN)
    }

    // WAIT until blockEnd so block is always exactly duration
    while(performance.now() < blockEnd){
        await sleep(5)
    }

    console.log("Stimuli this block:", stimCount)
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
    miniBoard.style.display = "none"
    rtGraph.style.display = "none"
    breakScreen.style.display = "none"
    updateMiniBoard()
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
            currentTrial = i 
            currentTrialData = {
                pattern: patternNumber,
                trial: i,
                baseline: null,
                pattern_block: null
            }

            experiment.trials.push(currentTrialData)

            await trialBarrier("baseline")
            await baseline(i)

            await breakScreenWait("baseline_break")

            await trialBarrier("pattern")
            await pattern(i)

            //Skip if more and go to expeirmen complete page
            if(i < REPEATS){
                await breakScreenWait("pattern_break")
            }

        }

    }
    stopPattern()
    const bestRT = allRTs.length ? Math.min(...allRTs) : null

    console.log("Experiment finished")
    console.log("All RTs:", allRTs)
    console.log("Best RT overall:", bestRT)
    status.innerText = "Saving..."
    experiment.allRTs = allRTs
    experiment.bestRT = bestRT

    try{

        const res = await fetch("/save",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify(experiment)
        })

        const leaderboard = await res.json()

        sessionStorage.setItem("leaderboard", JSON.stringify(leaderboard))

        console.log("Save success:", leaderboard)

    }catch(err){

        console.error("Save failed:", err)

    }

    showCompletionScreen()

}
run()