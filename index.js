import * as tf from '@tensorflow/tfjs'
import {loadGraphModel} from '@tensorflow/tfjs-converter'
import * as blazeface from '@tensorflow-models/blazeface'
const MODEL = 'model/tongue/model.json'
import p5 from 'p5'
// const FACE_MODEL = 'model/face/model.json'

const IMG_SIZE = 400
const THRESHOLD = .75
const PREVIEW_INTERFACE = true
const PREVIEW_SHADER = false

const classesDir = {
    1: {
        name: 'tongue',
        id: 1,
    }
}

let facePredictionsStore = []
let tick = 0

let offset = 0.0

const trimFace = (video,x,y,width,height) => {
    let cropped = document.createElement('canvas')
    cropped.width = width
    cropped.height = height
    cropped.getContext("2d").drawImage(video,x,y,width,height,0,0,width,height)
    return cropped
}

const parseDetection = (scores, threshold, boxes, classes, width, height) => {
    const detectionObjects = []
    scores.forEach((score, i) => {
        if (score > threshold) {
            const bbox = []
            const minY = boxes[i * 4] * height
            const minX = boxes[i * 4 + 1] * width
            const maxY = boxes[i * 4 + 2] * height
            const maxX = boxes[i * 4 + 3] * width
            bbox[0] = minX
            bbox[1] = minY
            bbox[2] = maxX - minX
            bbox[3] = maxY - minY

            detectionObjects.push({
                class: classes[i],
                label: classesDir[classes[i]].name,
                score: score.toFixed(4),
                bbox: bbox
            })
        }
    })
    return detectionObjects
}


const classify = async (tongueCanvas, tongueModel) => {
    const tensor = tf.browser.fromPixels(tongueCanvas)
    const output = await tongueModel.executeAsync(tensor.expandDims(0))
    const boxes = output[3].dataSync()
    const scores = output[1].arraySync()[0]
    const classes = output[0].dataSync()
    const width = tongueCanvas.width
    const height = tongueCanvas.height
    tensor.dispose()
    return parseDetection(scores, THRESHOLD, boxes, classes, width, height)
}

const drawAndTrimFace = async (facePredictions, faceCanvas) => {
    const width = faceCanvas.width
    const height = faceCanvas.weight
    const context = faceCanvas.getContext('2d')
    if (!facePredictions.length) return
    const facePrediction = facePredictions[0]
    const x = facePrediction.topLeft[0]
    const y = facePrediction.topLeft[1]
    const bWidth = (facePrediction.bottomRight[0] - facePrediction.topLeft[0])
    const bHeight = (facePrediction.bottomRight[1] - facePrediction.topLeft[1]) * 1.25

    const trimmed = trimFace(faceCanvas, x, y, bWidth, bHeight)

    if (PREVIEW_INTERFACE) {
        context.drawImage(trimmed, 0, 0)

        context.strokeStyle = '#FF0000'
        context.lineWidth=3
        context.strokeRect(
            x,
            y,
            bWidth,
            bHeight
        )

        const mouth = facePrediction.landmarks[3]
        context.beginPath()
        context.arc(mouth[0], mouth[1], 10, 0, Math.PI*2)
        context.stroke()
    }
    return trimmed
}


const predictAndDrawTongue = async (trimmed, tongueModel, tongueCanvas) => {
    const predictions = await classify(trimmed, tongueModel)
    const context2 = tongueCanvas.getContext('2d')
    context2.clearRect(0, 0, IMG_SIZE, IMG_SIZE)
    if (predictions.length) {
        const prediction = predictions[0]
        offset = (prediction.bbox[2] * prediction.bbox[3]) / 40000
        if (PREVIEW_INTERFACE) {
            tongueCanvas.width = trimmed.width
            tongueCanvas.height = trimmed.height
            context2.strokeStyle = '#66ff00'
            context2.lineWidth=3
            context2.strokeRect(
                prediction.bbox[0],
                prediction.bbox[1],
                prediction.bbox[2],
                prediction.bbox[3]
            )
        }
    } else {
        offset = 0.0
    }
}


const onFrame = async (video, faceCanvas, tongueModel, faceModel, tongueCanvas) => {
    const processFrame = async () => {
        const context = faceCanvas.getContext('2d')
        context.drawImage(video,0,0,faceCanvas.width,faceCanvas.height)
        const facePredictions = tick % 10 === 0 ? await faceModel.estimateFaces(faceCanvas, false) : facePredictionsStore
        const trimmed = await drawAndTrimFace(facePredictions, faceCanvas)
        await predictAndDrawTongue(trimmed, tongueModel, tongueCanvas)

        facePredictionsStore = facePredictions
        tick ++
        if (tick === 100) tick = 0
        requestAnimationFrame(processFrame)
    }
    await processFrame()
}

const onError = (error) => {
    console.log(error)
}

const onSuccess = (stream, tongueModel, faceModel) => {
    const video = document.createElement('video')
    video.autoplay = true
    video.srcObject = stream
    video.onloadedmetadata = async () => {
        if (PREVIEW_SHADER) { const sketchInstance = new p5(sketch) }
        const faceCanvas = document.createElement('canvas')
        const aspect = Math.min(IMG_SIZE / video.videoWidth, IMG_SIZE / video.videoHeight)
        faceCanvas.width = video.videoWidth * aspect
        faceCanvas.height = video.videoHeight * aspect
        const tongueCanvas = document.createElement('canvas')
        tongueCanvas.style = 'position: absolute; top: 0; left: 0'
        if (PREVIEW_INTERFACE) document.body.appendChild(faceCanvas) // to preview
        if (PREVIEW_INTERFACE) document.body.appendChild(tongueCanvas) // to preview

        await onFrame(video, faceCanvas, tongueModel, faceModel, tongueCanvas)
    }
}

const init = async () => {
    try {
        const faceModel = await blazeface.load()
        // const faceModel = await loadGraphModel(FACE_MODEL) // @todo compare performance of models
        const tongueModel = await loadGraphModel(MODEL)
        const constraints = window.constraints = {audio: false, video: true}
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        onSuccess(stream, tongueModel, faceModel)
    } catch (e) {
        onError(e)
    }
}

init().then(() => null)

// shader object and otheres
let theShader, video, backbuffer, canvas, start, width, height

const fakeOffset = (time) => {
    if (time < 20) return 0
    if (time < 23) return - (time / 1000) * 2
    if (time < 26) return - ((40 - time) / 1000) * 2
    return 0
}

const sketch = (s) => {
    s.preload = () => {
        // preeload shader
        theShader = s.loadShader('shaders/webcam.vert', 'shaders/webcam.frag')
    }

    s.setup = () => {
        width = 710
        height = 500
        canvas = s.createCanvas(width, height, s.WEBGL)
        s.noStroke()

        video = s.createCapture(s.VIDEO)
        video.size(width, height)
        video.hide()

        backbuffer = s.createGraphics(width, height, s.WEBGL)
        backbuffer.clear()
        start = Date.now()
    }

    s.draw = () => {
        backbuffer.clear()
        backbuffer.image(canvas, width * -0.5, height * -0.5, width, height)

        const time = (Date.now() - start) / 1000

        // set active shader
        s.shader(theShader)
        // video as a texture
        theShader.setUniform('video', video)
        theShader.setUniform('time', time) // timer
        theShader.setUniform('backbuffer', offset) // prev pix
        theShader.setUniform('offset', newOffset) // offset value from tongue aree
        // idk why but this is needed
        s.rect(0,0,width,height)
    }
}