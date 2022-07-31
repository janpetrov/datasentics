
function handleFiles() {
    for (const file of this.files) {
        var formData = new FormData();

        formData.append('file', file);  
        formData.append('isOverlayRequired', 'true');  
        formData.append('apikey', 'K88811114388957');

        const fetchData = {
            method: 'POST',
            headers: {
                apikey: 'K88811114388957',
            },
            body: formData
        }

        const outputElement = document.getElementById('output');
        outputElement.innerHTML = "";

        fetch('https://api.ocr.space/parse/image', fetchData)
            .then(response => response.json())
            .then(data => outputElement.innerHTML += `<div class="block contentsblock">${file.name}: ${JSON.stringify(data)}</div>`)
            .catch(error => outputElement.innerHTML += '<p>Conversion failed. Connection error.</p>');
    }

    // check file types
}

function setup() {
    document
        .getElementById('files')
        .addEventListener("change", handleFiles, false);
}
