import * as tf from '@tensorflow/tfjs'
import {loadGraphModel} from '@tensorflow/tfjs-converter'
const MODEL = 'model/model.json'

const IMG_SIZE = 224

const classesDir = {
    1: {
        name: 'tongue',
        id: 1,
    }
}

const parseDetection = (scores, threshold, boxes, classes) => {
    const detectionObjects = []
    scores.forEach((score, i) => {
        if (score > threshold) {
            const bbox = []
            const minY = boxes[i * 4] * IMG_SIZE
            const minX = boxes[i * 4 + 1] * IMG_SIZE
            const maxY = boxes[i * 4 + 2] * IMG_SIZE
            const maxX = boxes[i * 4 + 3] * IMG_SIZE
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


const classify = async (img, model) => {
    const tensor = tf.browser.fromPixels(img)
    const output = await model.executeAsync(tensor.expandDims(0))
    const boxes = output[3].dataSync()
    const scores = output[1].arraySync()[0]
    const classes = output[0].dataSync()
    tensor.dispose()
    return parseDetection(scores, .5, boxes, classes)
}

const onFrame = async (video, model) => {
    const processFrame = async () => {
        const predictions = await classify(video, model)
        drawBox(predictions)
        requestAnimationFrame(processFrame)
    }
    await processFrame()
}

const drawBox = (predictions) => {
    const box = document.querySelector('#box')
    const context = box.getContext('2d')
    context.clearRect(0, 0, IMG_SIZE, IMG_SIZE)
    if (!predictions.length) return
    const prediction = predictions[0]
    context.strokeStyle = '#66ff00'
    context.lineWidth=3
    context.strokeRect(
        prediction.bbox[0],
        prediction.bbox[1],
        prediction.bbox[2],
        prediction.bbox[3]
    )
    console.log(prediction)
}

const onError = (error) => {
    console.log(error)
}

const onSuccess = (stream, model) => {
    const video = document.querySelector('#video')
    video.srcObject = stream
    video.onloadedmetadata = async () => {
        await onFrame(video, model)
    }
}

const init = async () => {
    try {
        const model = await loadGraphModel(MODEL)
        const constraints = window.constraints = {audio: false, video: true}
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        onSuccess(stream, model)
    } catch (e) {
        onError(e)
    }
}

init().then(() => null)