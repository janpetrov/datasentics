
let allTexts = [];
let downloadedFileNos = []
let remainingFileNos = 0;


function enableDisableInput(what) {
    const el1 = document.getElementById('files');
    const el2 = document.getElementById('file-upload');
    if (what == 'enable') {
        el1.disabled = el2.disabled = false;
        el2.classList.remove('noglow');
    }
    else if (what == 'disable') {
        el1.disabled = el2.disabled = true;
        el2.classList.add('noglow');
    }
    else 
        alert('bad input: ' + what);
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

        enableDisableInput('enable');
    }
}

function processSingleFile(fileName, data, fileNo) {
    if (data.IsErroredOnProcessing) {
        addText(fileName, 
            'chyba zpracování souboru (např. chybný datový formát)', fileNo);
        return;
    }

    // the class is implemented at the end of this file
    const extractor = new SimplifiedExtract(); 

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
    // the user cannot enter new files while recognition proceeds
    enableDisableInput('disable');

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
        formData.append('OCREngine', 2);

        const fetchData = {
            method: 'POST',
            headers: {
                apikey: 'K88811114388957',
            },
            body: formData
        }

        const outputElement = document.getElementById('output');
        outputElement.innerHTML = "";

        sleep(50*fileNo).then(() => {
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

class ExtractNumbers{

    average(array, selector) {
        if (selector === undefined)
            return array.reduce((acc, val) => acc + val, 0) / array.length;
        else
            return array.reduce((acc, val) => acc + val[selector], 0) / array.length;
    }

    /** Each returned element has the structure (array w/ 4 elements):
        -- [0] increment in y compared to the previous item,
        -- [1] average increment in y within the group,
        -- the group spans the tops array from its [2] index,
        -- to its [3] index
    Diff of element 0 is unimportant. Elements (groups) 1..n "decide"
    whether to merge with the immediately preceding group.
    */
    createGroups(tops) {
        return tops.map((v, i) => ({
            jumpY: (i > 0) ? v - tops[i-1] : 0,  // jump for the first element is 0
            avgGroupJump: Number.POSITIVE_INFINITY,
            leftIdx: i,
            rightIdx: i
        }));
    }

    /** Returns the index of the element with the smallest positive difference
     * in Y increment.
     */
    groupsMinJump(groups) {
        // as groups include a small number of lines (hundreds) we refrain
        // from implementing the priority queue
        let minJump = Number.POSITIVE_INFINITY;
        let index = -1;
        for (let i = 1; i < groups.length; ++i) 
            if (groups[i].jumpY > 0 && groups[i].jumpY < minJump) {
                minJump = groups[i].jumpY;
                index = i;
            }
        return index;
    }

    /** The API returns lines consecutively, from the top of each paragraph
    to its bottom. However, the API does not indicate any division 
    between paragraphs. We will discover the divisions using the following 
    greedy algorithm. 
    We will always merge to consecutive lines whose difference in y position is
    the lowest (or groups whose difference in average y position is the lowest). 
    If however the averages are too different, we stop merging and look at the 
    groups found so far.
    */
    mergeGroups(groups) {
        while(true) {
            const i = this.groupsMinJump(groups);

            if (i == -1)
                break;  // cannot merge anymore (negative jumps only)

            const nowJump = groups[i].jumpY;
            const leftAvgJump = groups[i-1].avgGroupJump;
            const rightAvgJump = groups[i].avgGroupJump;

            const jumpOK = (avg) => { 
                return avg == Number.POSITIVE_INFINITY || 
                    nowJump < avg * (1 + MAX_MERGE_PERCENTAGE)
                    // avg < nowJump * (1 + MAX_MERGE_PERCENTAGE))
            }
            
            if (!jumpOK(leftAvgJump) || !jumpOK(rightAvgJump))
                break;

            // no break occurred, so we can merge the two closest groups together    
            if (leftAvgJump== Number.POSITIVE_INFINITY &&
                    rightAvgJump == Number.POSITIVE_INFINITY)
                groups[i-1].avgGroupJump = nowJump;
            else if (leftAvgJump== Number.POSITIVE_INFINITY)
                groups[i-1].avgGroupJump = rightAvgJump;
            else if (rightAvgJump==Number.POSITIVE_INFINITY)
                groups[i].avgGroupJump = leftAvgJump;
            else {
                const leftN = groups[i-1].rightIdx - groups[i-1].leftIdx + 1;
                const rightN = groups[i].rightIdx - groups[i].leftIdx + 1;
                groups[i-1].avgGroupJump = (leftAvgJump * leftN + rightAvgJump * rightN) /
                                        (leftN + rightN);
            }

            groups[i-1].rightIdx = groups[i].rightIdx; // extend the left group to the end
                                                    //   of the right group

            groups.splice(i, 1) // remove the right group (which has been already merged
                                // into the left group) from groups
        }
    }

    groupAverageY(group, tops) {
        return this.average(tops.slice(group.leftIdx, group.rightIdx+1))
    }
    
    groupText(group, overlayLines) {
        let resultText = '';
        for (let i = group.leftIdx; i <= group.rightIdx; ++i) {
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
        const singles = sorted.filter(a => a.leftIdx == a.rightIdx);
        const multis = sorted.filter(a => a.rightIdx > a.leftIdx);

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

    /** the main method of the class */
    run(data) {
        const text = data.ParsedResults[0].ParsedText
        const overlayLines = data.ParsedResults[0].TextOverlay.Lines
        // compute average top position of each line (the average for words on that line)
        const tops = overlayLines.map(line => this.average(line.Words, 'Top'));

        // initialization: each line has its own group
        let groups = this.createGroups(tops);
        // adjacent lines form a single group 
        this.mergeGroups(groups); 

        // we add information regarding position and text to each group object
        for (let group of groups) {
            group.averageY = this.groupAverageY(group, tops); 
            group.text = this.groupText(group, overlayLines);         
        }

        groups = this.sortedGroups(groups);

        return this.numbersFromGroups(groups);
    }
};



const MERGE_LIMIT = 30;

/**
 * The default merge method in ExtracNumbers class does not, as it showed out, work well. 
 * While it is theoretically, in the real world, it is fragile (non-robust) given bad inputs.
 * In particular it can happend that the OCR/API returns the text on the same line as two 
 * separate lines, where the y position of the "second" line  * is only few pixels more than 
 * the y position of the "first line". This highly subaverage  * jump then inteferes with 
 * correct functioning of the algorithm.
 * 
 * Therefore, we have changed merging to this simple method. This is just for demonstration
 * purposes. The solution can be extended to take into account different font-sizes and/or
 * further information.
 */
class SimplifiedExtract extends ExtractNumbers {
    mergeGroups(groups) {
        let i = 1;
        while(i < groups.length) {
            const nowJump = groups[i].jumpY;
            if (nowJump > 0 && nowJump <= MERGE_LIMIT) {
                groups[i-1].rightIdx = groups[i].rightIdx; // extend the left group to the end
                //   of the right group

                groups.splice(i, 1) // remove the right group (which has been already merged
                // into the left group) from groups       
            }
            else
                ++i;  // increment i only if a group was not deleted
        }
    }
}