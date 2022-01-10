module.exports = getTableColumns;
let quickAddApi;

async function getTableColumns (params) {
    ({quickAddApi} = params)
    let CS = await quickAddApi.inputPrompt("列以逗号分隔");
    const C = CS.split(",").map(Number)
    const activeLeaf = app.workspace.activeLeaf
    let selection = activeLeaf.view.editor.getSelection()
    const tArr = selection.split("\n")
    let fullArr = []
    for (const t of tArr){
        fullArr.push(t.split("\|"))
    }
    let result = ""
    for(let i = 0; i < fullArr.length; i++){
        if (fullArr[i].length < 2) continue;
        let line = "\|"
        for(let j = 0; j < C.length; j++){
            line +=  fullArr[i][C[j]] + "\|"
        }
        result += line + "\r\n"
    }
    await navigator.clipboard.writeText(result)
}

