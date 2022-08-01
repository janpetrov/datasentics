
let allTexts = [];
let downloadedFileNos = []
let remainingFileNos = 0;


function uploadInProgress(inProgress) {
    const linkElement = document.getElementById('files');
    const boxElement = document.getElementById('file-upload');
    if (inProgress) {
        document.getElementById('spinner').style.display = 'block';
        linkElement.disabled = boxElement.disabled = true;
        boxElement.classList.add('noglow');
    }
    else {
        document.getElementById('spinner').style.display = 'none';
        linkElement.disabled = boxElement.disabled = false;
        boxElement.classList.remove('noglow');
    }
}

function addText(fileName, textInput, fileNo) {
    --remainingFileNos;
    downloadedFileNos[fileNo] = true;

    allTexts[fileNo] = fileName + ': ' + textInput;

    const text = `<b>${fileName}</b>: ` + textInput;
    const divHTML = `<div id="cont${fileNo}" class="block contentsblock">${text}</div>`;

    // find previous filled position
    let i = fileNo - 1;
    while (i >= 0 && !downloadedFileNos[i])
        --i;

    if (i < 0)
        // if none, place as the first item
        document.getElementById('output').insertAdjacentHTML('afterbegin', divHTML);
    else 
        // if some, place just after it
        document.getElementById(`cont${i}`).insertAdjacentHTML('afterend', divHTML);

    // last file processed => creat downloadable file
    if (remainingFileNos==0) {
        const fileTexts = allTexts.reduce((a,b) => a + '\n' + b);
        const blob = new Blob([fileTexts], { type: "text/plain;charset=utf8" });
        const url = URL.createObjectURL(blob);
        const downloadElement = document.getElementById('downloadref');
        downloadElement.href = url;
        document.getElementById('downloadblock').style.display = 'block'; // unhide
        uploadInProgress(false);
    }
}

function processSingleFile(fileName, data, fileNo) {
    if (data.IsErroredOnProcessing) {
        addText(fileName, 
            'chyba zpracování souboru (např. chybný datový formát)', fileNo);
        return;
    }

    // the class is implemented at the end of this file
    const extractor = new ExtractNumbers(); 

    // extractor.run() returns lists (one item per rectangle) of 
    // list (one item per number in the rectangle)

    // we merge numbers within rectangles
    const nums = extractor.run(data).map(item => 
        (item.length==0) ? '' : item.reduce((a,b) => '' + a + '; ' + b)
    );
    
    // then we merge rectangles
    const text = nums.reduce((a,b) => a + ' | ' + b);
    addText(fileName, text, fileNo);

    // unhide elements
    document.getElementById('info1').style.display = 'block';
    document.getElementById('info2').style.display = 'block';
}

function sleep (time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

function handleFiles() {
    // no action if user chose no file (e.g., just closed the file window)
    if (this.files.length == 0)
        return;

    // the user cannot enter new files while recognition proceeds
    uploadInProgress(true);

    allTexts = Array(this.files.length).fill('');
    downloadedFileNos = Array(this.files.length).fill(false);
    remainingFileNos = this.files.length;

    for (let fileNo = 0; fileNo < this.files.length; ++fileNo) {
        const file = this.files[fileNo];

        var formData = new FormData();

        formData.append('file', file);  
        formData.append('isOverlayRequired', true);  
        formData.append('apikey', 'K88811114388957');
        formData.append('detectOrientation', true);
        // formData.append('OCREngine', 2);

        const fetchData = {
            method: 'POST',
            headers: {
                apikey: 'K88811114388957',
            },
            body: formData
        }

        const outputElement = document.getElementById('output');
        outputElement.innerHTML = "";

        sleep(250*fileNo).then(() => {
            fetch('https://api.ocr.space/parse/image', fetchData)
            .then(response => response.json())
            .then(data => processSingleFile(file.name, data, fileNo))
            // .then(data => outputElement.innerHTML += JSON.stringify(data))
            .catch(error => addText(file.name, 'chyba spojení', fileNo));
        });
    }
}

function setup() {
    document
        .getElementById('files')
        .addEventListener("change", handleFiles, false);

    const blob = new Blob([allTexts], { type: "text/plain;charset=utf8" });
    const url = URL.createObjectURL(blob);

    const downloadElement = document.getElementById('downloadref');
    downloadElement.href = url;
    downloadElement.innerText = 'stáhni jako .txt soubor';
    downloadElement.download='extracted_numbers.txt';
    downloadElement.display='none';
}



const MAX_MERGE_PERCENTAGE = 0.5;
const MERGE_LIMIT = 20;

class ExtractNumbers{

    average(array, selector) {
        if (selector === undefined)
            return array.reduce((acc, val) => acc + val, 0) / array.length;
        else
            return array.reduce((acc, val) => acc + val[selector], 0) / array.length;
    }

    /**
     * The OCR API returns scanned lines, but does not indicate where
     * one block ends and another begins. This method finds the breaks,
     * in particular to determine the single-line paragraph.
     * 
     * The method can, to some extent extract even lines of a block that
     * the OCR API wrongly puts inside lines of another block.
     */
    mergeGroups(groups, overlayLines) {
        const noHorizontalOverlap = i =>
            groups[i].left < groups[i-1].left - MERGE_LIMIT &&
            groups[i].right < groups[i-1].left - MERGE_LIMIT 
            ||
            groups[i].left > groups[i-1].right + MERGE_LIMIT &&
            groups[i].right > groups[i-1].right + MERGE_LIMIT;
        
        const noVerticalOverlap = i =>
            groups[i].top < groups[i-1].top || 
            groups[i].top > groups[i-1].bottom + MERGE_LIMIT;

        let extractedGroups = [];

        const extractGroup = i => {
            extractedGroups.push(groups[i]);
            groups.splice(i, 1);
        }

        const bothEndsFailed = i => groups[i].leftFailed && groups[i].rightFailed;

        groups[0].leftFailed = groups[groups.length-1].rightFailed = true;

        for(let bigCycle = 0; bigCycle < 10 && groups.length > 0; ++bigCycle) {
            let i = 1;
            while (i < groups.length) {
                if (noHorizontalOverlap(i) || noVerticalOverlap(i)) {
                    groups[i].leftFailed = groups[i-1].rightFailed = true;
                    ++i;
                }
                else {
                    groups[i-1].indices = [...groups[i-1].indices, ...groups[i].indices]
                    groups[i-1].indices.sort((a,b) => a - b);
                    groups[i-1].left = Math.min(groups[i-1].left, groups[i].left);
                    groups[i-1].right = Math.max(groups[i-1].right, groups[i].right);
                    groups[i-1].top = Math.min(groups[i-1].top, groups[i].top);
                    groups[i-1].bottom = Math.max(groups[i-1].bottom, groups[i].bottom);

                    groups.splice(i, 1) // remove the right group (which has been already merged
                    // into the left group) from groups       
                }
            }

            // get groups whose both end failed
            // extract the shortest one
            // if more groups have length 1, chose the one starting with a numeral
            let [idx, len, withNum] = [-1, Number.POSITIVE_INFINITY, false];
            for (let curr = 0; curr < groups.length; ++curr) {
                const currentLength = groups[curr].indices.length;
                if (bothEndsFailed(curr) && 
                        currentLength == len &&      // this & some previous are the shortest
                        len == 1 &&
                        !withNum &&                  // line with num not found yet
                        !isNaN(overlayLines[groups[curr].indices[0]].LineText[0])) {
                    idx = curr; withNum = true;
                }
                else if (bothEndsFailed(curr) && currentLength < len) {
                    idx = curr; len=currentLength;
                }
            }
            if (idx >= 0)
                extractGroup(idx);
        }

        return [...extractedGroups, ...groups];
    }

    groupAverageY(group, tops) {
        return this.average(group.indices.map(i => tops[i]));
    }
    
    groupText(group, overlayLines) {
        let resultText = '';
        for (let i of group.indices) {
            const sep = (resultText.length > 0) ? ' ' : '';
            resultText += sep + overlayLines[i].LineText;
        }
        return resultText;
    }

    /** we sort the groups array so that the single-line paragraph(s) come first,
        then the paragraphs will be sorted according to their average Y position
        (from the topmost to the bottommost) 
    */
    sortedGroups(groups) {
        // sort groups according to Y positions
        let sorted = [...groups].sort((g1, g2) => g1.averageY - g2.averageY);

        // filter groups with single / multiple lines
        const singles = sorted.filter(a => a.indices.length == 1);
        const multis = sorted.filter(a => a.indices.length != 1);

        return [...singles, ...multis];  // merge the arrays together again
    }

    /** we return list (one item per group) with list of included numbers */
    numbersFromGroups(groups) {
        const regexp = /\d+(?:[\s,]\d+)*(?:\.\d+)?/g;
        return groups.map(group => {
            const matched = group.text.match(regexp);
            return (matched === null) ? [] : 
                matched.map(numstr => parseFloat(numstr.replace(',','').replace(' ', '')))
        });
    }

    computeBounds(overlayLines) {
        return {
            tops: overlayLines.map(line => Math.min(...line.Words.map(item => item.Top))),

            lefts: overlayLines.map(line => Math.min(...line.Words.map(item => item.Left))),

            bottoms: overlayLines.map(line => 
                Math.max(...line.Words.map(item => item.Top + item.Height))),

            rights: overlayLines.map(line => 
                Math.max(...line.Words.map(item => item.Left + item.Width)))
        }
    }

    createGroups(bounds) {
        return bounds.tops.map((top, i) => ({
            top: top,
            left: bounds.lefts[i],
            right: bounds.rights[i],
            bottom: bounds.bottoms[i],
            indices: [i],
            leftFailed: false,
            rightFailed: false
        }));
    }

    /** the main method of the class */
    run(data) {
        const text = data.ParsedResults[0].ParsedText
        const overlayLines = data.ParsedResults[0].TextOverlay.Lines
        // compute average top position of each line (the average for words on that line)
        // const tops = overlayLines.map(line => this.average(line.Words, 'Top'));

        const bounds = this.computeBounds(overlayLines);

        // initialization: each line has its own group
        let groups = this.createGroups(bounds);
        // adjacent lines form a single group 
        groups = this.mergeGroups(groups, overlayLines); 

        // we add information regarding position and text to each group object
        for (let group of groups) {
            group.averageY = this.groupAverageY(group, bounds.tops); 
            group.text = this.groupText(group, overlayLines);         
        }

        groups = this.sortedGroups(groups);

        return this.numbersFromGroups(groups);
    }
};
