module.exports = setChildTask

async function setChildTask (params) {
    ({quickAddApi} = params) 
    const activeLeaf = app.workspace.activeLeaf
    let selection = activeLeaf.view.editor.getSelection()
    let list = selection.split("\n")
    let result = "\r\n"
    for (let index = 0; index < list.length; index++) {
        if (index != 0) {
            result += "<br>"
        }
        result += list[index].trim();
    }
    return result
}

