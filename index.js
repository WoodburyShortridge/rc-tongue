import * as tf from '@tensorflow/tfjs'
import {loadGraphModel} from '@tensorflow/tfjs-converter'
import * as blazeface from '@tensorflow-models/blazeface'
const MODEL = 'model/model.json'

const IMG_SIZE = 400
const THRESHOLD = .75

const classesDir = {
    1: {
        name: 'tongue',
        id: 1,
    }
}

let facePredictionsStore = []
let tick = 0

const trimFace = (video,x,y,width,height) => {
    let cropped = document.createElement('canvas');
    cropped.width = width;
    cropped.height = height;
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


const classify = async (canvas, model) => {
    const tensor = tf.browser.fromPixels(canvas)
    const output = await model.executeAsync(tensor.expandDims(0))
    const boxes = output[3].dataSync()
    const scores = output[1].arraySync()[0]
    const classes = output[0].dataSync()
    const width = canvas.width
    const height = canvas.height
    tensor.dispose()
    return parseDetection(scores, THRESHOLD, boxes, classes, width, height)
}

const drawAndTrimFace = async (facePredictions, canvas, model, tongueCanvas) => {
    const width = canvas.width
    const height = canvas.weight
    const context = canvas.getContext('2d')
    if (!facePredictions.length) return
    const facePrediction = facePredictions[0]
    const x = facePrediction.topLeft[0]
    const y = facePrediction.topLeft[1]
    const bWidth = (facePrediction.bottomRight[0] - facePrediction.topLeft[0])
    const bHeight = (facePrediction.bottomRight[1] - facePrediction.topLeft[1]) * 1.25

    const trimmed = trimFace(canvas, x, y, bWidth, bHeight)
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

    const predictions = await classify(trimmed, model)
    const context2 = tongueCanvas.getContext('2d')
    context2.clearRect(0, 0, IMG_SIZE, IMG_SIZE)
    if (predictions.length) {
        const prediction = predictions[0]
        tongueCanvas.width = bWidth
        tongueCanvas.height = bHeight
        context2.strokeStyle = '#66ff00'
        context2.lineWidth=3
        context2.strokeRect(
            prediction.bbox[0],
            prediction.bbox[1],
            prediction.bbox[2],
            prediction.bbox[3]
        )
    }
}


const onFrame = async (video, canvas, model, faceModel, tongueCanvas) => {
    const processFrame = async () => {
        const context = canvas.getContext('2d')
        context.drawImage(video,0,0,canvas.width,canvas.height)
        const facePredictions = tick % 10 === 0 ? await faceModel.estimateFaces(canvas, false) : facePredictionsStore
        await drawAndTrimFace(facePredictions, canvas, model, tongueCanvas)
        
        facePredictionsStore = facePredictions
        tick ++
        requestAnimationFrame(processFrame)
    }
    await processFrame()
}

const onError = (error) => {
    console.log(error)
}

const onSuccess = (stream, model, faceModel) => {
    const video = document.createElement('video')
    video.autoplay = true
    video.srcObject = stream
    video.onloadedmetadata = async () => {
        const canvas = document.createElement('canvas')
        const aspect = Math.min(IMG_SIZE / video.videoWidth, IMG_SIZE / video.videoHeight);
        canvas.width = video.videoWidth * aspect
        canvas.height = video.videoHeight * aspect
        document.body.appendChild(canvas)
        const tongueCanvas = document.createElement('canvas')
        tongueCanvas.style = 'position: absolute; top: 0; left: 0'
        document.body.appendChild(tongueCanvas)
        await onFrame(video, canvas, model, faceModel, tongueCanvas)
    }
}

const init = async () => {
    try {
        const faceModel = await blazeface.load();
        const model = await loadGraphModel(MODEL)
        const constraints = window.constraints = {audio: false, video: true}
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        onSuccess(stream, model, faceModel)
    } catch (e) {
        onError(e)
    }
}

init().then(() => null)