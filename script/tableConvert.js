module.exports = tableConvert;

let list = ["👉️ MD", "👉️ HTML", "👉️ CSV", "👉️ JSON", "👉️ SQL"]
let toType = ["md", "html", "csv", "json", "sql"]
let quickAddApi
let headArray = []
let bodyArray = []
let result = ""
async function tableConvert(params) {
    init(params);
    let context = await quickAddApi.utility.getClipboard()
    let pdContext = processContext(context)
    let type = checkType(pdContext)
    switch (type) {
        case "md":
            await mdToArray(pdContext)
            break
        case "html":
            await htmlToArray(pdContext)
            break
        case "json":
            await jsonToArray(pdContext)
            break
        case "sql":
            await sqlToArray(pdContext)
            break
        case "csv":
            await csvToArray(pdContext)
            break
    }
    console.log(headArray);
    console.log(bodyArray);
    list.splice(toType.indexOf(type),1)
    toType.splice(toType.indexOf(type),1);
    console.log(list);
    console.log(toType);
    const inType = await quickAddApi.suggester(list, toType);
    switch (inType) {
        case "md":
            await arrayToMd()
            break
        case "html":
            await arrayToHtml()
            break
        case "json":
            await arrayToJson()
            break
        case "sql":
            await arrayToSql()
            break
        case "csv":
            await arrayToCsv()
            break
    }
    console.log(result)
    await quickAddApi.utility.setClipboard(result)
}

async function arrayToSql(){
    result += "INSERT INTO tableName ( "
    for (let i = 0; i < headArray.length; i++) {
        result += headArray[i].toString()
        if (i != headArray.length -1){
            result += ", "
        }
    }
    result += " )\r\nVALUES\r\n"
    for (let i = 0; i < bodyArray.length; i++) {
        result += times(" ",4)
        result += "("
        for (let j = 0; j < headArray.length; j++) {
            result += "\'" + bodyArray[i][j] + "\'"
            if (j != bodyArray[i].length -1){
                result += ", "
            }
        }
        result += ")"
        if (i == bodyArray.length-1){
            result += ";"
        }else{
            result += ","
        }
        result += "\r\n"
    }
    
}

async function sqlToArray(pdContext){
    let data = pdContext.match(/\((.+?)\)/g)
    let tempHead = data[0].replace(/^\(+|\)+$/gm, "").split(",")
    for (let i = 0; i < tempHead.length; i++) {
        headArray.push(tempHead[i].trim())
    }
    
    for (let i = 0; i < data.length -1; i++) {
        if (!bodyArray[i]) {
            bodyArray[i] = new Array();
        }
        let tempSqlTable = data[i + 1].replace(/^\(+|\)+$/gm, "").split(",")
        for (let j = 0; j < tempSqlTable.length; j++) {
            bodyArray[i][j] = tempSqlTable[j].trim().replace(/^\'+|\'+$/gm, "")
        }
        
    }
}

async function arrayToCsv(){
    result += headArray.toString() + "\r\n"
    for (let i = 0; i < bodyArray.length; i++) {
        result += bodyArray[i].toString() + "\r\n"
    }
}

async function arrayToJson(){
    let indentCount = 1
    result += "[\r\n"
    for (let i = 0; i < bodyArray.length; i++) {
        let bodyLine = bodyArray[i];
        result += buildJson(headArray, bodyLine, indentCount)
        if(i != bodyArray.length - 1){
            result += ","
        }
        result += "\r\n"
    }
    result += "]\r\n"
}

function buildJson(keys, list, indent){
    let jsonStr = times(" ",indent*4) + "{\r\n"
    for (let i = 0; i < list.length; i++) {
        jsonStr += times(" ",(indent+1)*4) + "\"" +keys[i].trim() + "\"" + ":" + "\"" + list[i].trim() + "\""
        if (i != list.length - 1) {
            jsonStr += ","
        }
        jsonStr += "\r\n"
    }
    jsonStr += times(" ",indent*4) + "}"
    return jsonStr
}

/**
 * 
 * 数组转HTML
 * 
 */
async function arrayToHtml(){
    let indentCount = 1
    result += "<table>\r\n"
    result += buildTable(headArray,indentCount)
    for (let i = 0; i < bodyArray.length; i++) {
        let bodyLine = bodyArray[i];
        result += buildTable(bodyLine, indentCount)
    }
    result += "</table>\r\n"
}

/**
 * 
 * 生成HTML表格行
 * 
 */
function buildTable(list, indent){
    let tableStr = times(" ",indent*4) + "<tr>\r\n"
    for (let i = 0; i < list.length; i++) {
        tableStr += times(" ",(indent+1)*4) + "<td>" + list[i] + "</td>\r\n"
    }
    tableStr += times(" ",indent*4) + "</tr>\r\n"
    return tableStr
}


/**
 * 
 * 数组转MD
 * 
 */

async function arrayToMd() {
    let colLength = []
    for (let i = 0; i < headArray.length; i++) {
        let max = headArray[i].length
        for (let j = 0; j < bodyArray.length; j++) {
            const c = bodyArray[j][i].length
            if (max < c) {
                max = c
            }
        }
        colLength.push(max + 2)
    }
    console.log(colLength);
    for (let i = 0; i < colLength.length; i++) {
        if (i == 0) {
            result += "\|"
        }
        result += alignCol(headArray[i], colLength[i]) + "\|"
    }
    result += "\r\n"


    for (let i = 0; i < colLength.length; i++) {
        if (i == 0) {
            result += "\|"
        }
        result += " " + times("-", colLength[i] - 2) + " " + "\|"
    }
    result += "\r\n"


    for (let i = 0; i < bodyArray.length; i++) {
        for (let j = 0; j < colLength.length; j++) {
            if (j == 0) {
                result += "\|"
            }
            result += alignCol(bodyArray[i][j], colLength[j]) + "\|"
        }
        result += "\r\n"
    }

}

/**
 * 
 * 对齐MD表格列
 * 
 */
function alignCol(str, length) {
    return times(" ", (length - str.length - 1) / 2) + str + times(" ", (length - str.length) / 2)
}


/**
 * 
 * Html 转 数组
 * 
 */
async function htmlToArray(pdContext) {
    let parser = new DOMParser()
    let htmlDoc = parser.parseFromString(pdContext, "text/html")
    let htmlTable = htmlDoc.getElementsByTagName("table")[0]
    if(htmlTable.rows[0].cells[0].innerText == ""){
        await complexHtmlToArray(parser,htmlTable)
    }else{
        simpleHtmlToArray(htmlTable)
    }
    
}

function simpleHtmlToArray(htmlTable){
    let data = []
    for (let i = 0, rows = htmlTable.rows.length; i < rows; i++) {
        if (!data[i]) {
            data[i] = new Array();
        }
        for (let j = 0, cells = htmlTable.rows[i].cells.length; j < cells; j++) {
            data[i][j] = htmlTable.rows[i].cells[j].innerText.trim()
        }
    }
    headArray = data[0]
    bodyArray = data.slice(1)
}

async function complexHtmlToArray(parser,htmlTable){
    let ignoreTag = ["html", "head", "body"]
    let data = []
    let tempTable = parser.parseFromString(htmlTable.rows[0].cells[0].innerHTML, "text/html")
    let tags = getAllTags(tempTable).flat()
    for (let i = 0; i < ignoreTag.length; i++) {
        tags.splice(tags.indexOf(ignoreTag[i]),1)
    }
    const innerItemTag = await quickAddApi.suggester(tags, tags)
    let attributes = []
    let attrMap = tempTable.getElementsByTagName(innerItemTag)[0].attributes
    for (let i = 0; i < attrMap.length; i++) {
        attributes.push(attrMap[i].name)
    }
    const innerItemAttr = await quickAddApi.suggester(attributes, attributes)
    for (let i = 0, rows = htmlTable.rows.length; i < rows; i++) {
        if (!data[i]) {
            data[i] = new Array();
        }
        for (let j = 0, cells = htmlTable.rows[i].cells.length; j < cells; j++) {
            let innerItemHTML = htmlTable.rows[i].cells[j].innerHTML
            let item = parser.parseFromString(innerItemHTML, "text/html")
            data[i][j] = item.getElementsByTagName(innerItemTag)[0].getAttribute(innerItemAttr).trim()
        }
    }
    headArray = data[0]
    bodyArray = data.slice(1)
}

function getAllTags(tempTable){
    let tags = tempTable.getElementsByTagName('*')
    let tagsArr = []
    for (let i = 0; i < tags.length; i++) {  
        tagsArr.push((tags[i].tagName).toLowerCase())  
    }  
    let temp = []  //该数组用于存放相同的元素    
    let tag =[] //该数组用于存放每一个标签；
    for (let i = 0; i < tagsArr.length; i++) {  
    for (let j = i+1; j < tagsArr.length+1; j++) {  
        if (tagsArr[i] == tagsArr[j]) {  
            temp.push(tagsArr[j])
            tagsArr.splice(j,1) 
            j--
        }  
        if (j == tagsArr.length -i) {  
            temp.push(tagsArr[i])
            tagsArr.splice(i,1)
            i--
            tag.push(temp)
            temp = []
        }
    }
    }
    return tag
}

/**
 * 
 * CSV 转数组
 * 
 */
async function csvToArray(pdContext) {
    const tArr = pdContext.split("\n")
    let data = []
    for (let t of tArr) {
        data.push(t.split(","))
    }
    headArray = data[0]
    bodyArray = data.slice(1)
}

async function jsonToArray(pdContext){
    let data = JSON.parse( pdContext );
    for (const key in data[0]) {
        headArray.push(key.trim())
    }
    for (let i = 0; i < data.length; i++) {
        if (!bodyArray[i]) {
            bodyArray[i] = new Array();
        }
        for (let j = 0; j < headArray.length; j++) {
            bodyArray[i][j] = data[i][headArray[j]].toString().trim()
        }
        
    }
    console.log(data)
}

/**
 * 
 *  MarkDown 转 数组
 * 
 */
async function mdToArray(pdContext) {
    const tArr = pdContext.split("\n")
    let data = []
    for (let t of tArr) {
        t = t.replace(/\s+/g, "").replace(/^\|+|\|+$/gm, "");
        data.push(t.split("\|"))
    }
    headArray = data[0]
    bodyArray = data.slice(2)
}



/**
 * 
 * 字符串乘法
 * 
 */
function times(str, num) {
    return num > 1 ? str += times(str, --num) : str; 
}


/**
 * 
 * 检测类型
 * 
 */

function checkType(pdContext) {
    if (pdContext.startsWith("\|")) {
        return "md"
    }
    if (pdContext.startsWith("<table")) {
        return "html"
    }
    if (pdContext.startsWith("[") || pdContext.startsWith("{")){
        return "json"
    }
    if (pdContext.toUpperCase().startsWith("INSERT")){
        return "sql"
    }
    if (pdContext.indexOf(",") != -1) {
        return "csv"
    }
}

/**
 * 
 * 预处理文本
 * 
 */

function processContext(context) {
    return context.trim()
}

function init(params) {
    ({ quickAddApi } = params)
}