
function handleFiles() {
    var formData = new FormData();
    const file = this.files[0];
    formData.append('file', file);    
    const fetchData = {
        method: 'POST',
        headers: {
            apikey: 'K88811114388957'
        },
        body: formData
    }

    const outputElement = document.getElementById('output');

    fetch('https://api.ocr.space/parse/image', fetchData)
        .then(response => response.json())
        .then(data => outputElement.innerText = JSON.stringify(data))
        .catch(error => outputElement.innerText = 'Conversion failed. Connection error.');

    // check file types
}

function setup() {
    document
        .getElementById('files')
        .addEventListener("change", handleFiles, false);
}