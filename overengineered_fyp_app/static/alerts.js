// alerts.js

export function showSticker(text, duration=1200){

    const layer = document.getElementById("alertLayer")

    const el = document.createElement("div")
    el.className = "alertSticker"

    el.innerHTML = text

    layer.appendChild(el)

    setTimeout(()=>{
        el.remove()
    }, duration)

}
export function showMascot({
    textTop = "",
    textBottom = "",
    duration = 2500,
    right = "40px",
    bottom = "40px"
} = {}){

    const layer = document.getElementById("alertLayer")

    const container = document.createElement("div")
    container.className = "mascotAlert"

    container.style.right = right
    container.style.bottom = bottom

    const top = document.createElement("div")
    top.className = "mascotTextTop"
    top.innerText = textTop

    const vid = document.createElement("video")
    vid.src = "/static/videos/pokko_cleaned.webm"
    vid.autoplay = true
    vid.muted = true
    vid.loop = true
    vid.playsInline = true
    vid.className = "mascotVideo"

    const bottomText = document.createElement("div")
    bottomText.className = "mascotTextBottom"
    bottomText.innerText = textBottom

    container.appendChild(top)
    container.appendChild(vid)
    container.appendChild(bottomText)

    layer.appendChild(container)

    setTimeout(()=>{
        container.remove()
    }, duration)
}
export function clearAlerts(){
    const layer = document.getElementById("alertLayer")
    if(!layer) return

    layer.innerHTML = ""
}