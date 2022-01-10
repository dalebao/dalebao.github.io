module.exports = chinese
let quickAddApi;

async function chinese (params) {
    await init(params)
    const activeLeaf = app.workspace.activeLeaf
    let selection = activeLeaf.view.editor.getSelection()
    let list = ["《书名号》","「直角引号」","『内部引号』","【括号】","〖内部括号〗","〔六角括号〕","（小括号）","［方括号］","〈书名号〉", " 名‧姓"]
    let result =  ["《》","「」","『』","【】","〖〗","〔〕","（）","［］","〈〉", "‧"]
    let tag =  await await quickAddApi.suggester(list, result)
    return tag.slice(0,1) + selection + tag.slice(1)
}

async function init (params) {
    ({quickAddApi} = params) 
}