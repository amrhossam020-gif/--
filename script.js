// ========================================
// إعداد قاعدة البيانات
// ========================================

const DB_NAME = "QuizDatabase";
const DB_VERSION = 1;

const FILES_STORE = "files";
const QUESTIONS_STORE = "questions";

let db = null;

let currentQuizQuestions = [];

let currentQuestionIndex = 0;

let currentScore = 0;

let answered = false;

let solvedQuestions = new Set();

// تخزين إجابة المستخدم لكل سؤال
let userAnswers = {};


// ========================================
// فتح قاعدة البيانات
// ========================================

function openDatabase() {

    return new Promise((resolve, reject) => {

        const request =
            indexedDB.open(
                DB_NAME,
                DB_VERSION
            );


        request.onupgradeneeded =
            function (event) {

                const database =
                    event.target.result;


                if (
                    !database.objectStoreNames
                        .contains(FILES_STORE)
                ) {

                    const filesStore =
                        database.createObjectStore(
                            FILES_STORE,
                            {
                                keyPath: "id"
                            }
                        );


                    filesStore.createIndex(
                        "category",
                        "category",
                        {
                            unique: false
                        }
                    );


                    filesStore.createIndex(
                        "createdAt",
                        "createdAt",
                        {
                            unique: false
                        }
                    );

                }


                if (
                    !database.objectStoreNames
                        .contains(QUESTIONS_STORE)
                ) {

                    const questionsStore =
                        database.createObjectStore(
                            QUESTIONS_STORE,
                            {
                                keyPath: "id"
                            }
                        );


                    questionsStore.createIndex(
                        "fileId",
                        "fileId",
                        {
                            unique: false
                        }
                    );


                    questionsStore.createIndex(
                        "category",
                        "category",
                        {
                            unique: false
                        }
                    );

                }

            };


        request.onsuccess =
            function (event) {

                db =
                    event.target.result;

                console.log(
                    "✅ قاعدة البيانات جاهزة"
                );

                resolve(db);

            };


        request.onerror =
            function () {

                console.error(
                    "❌ خطأ في قاعدة البيانات",
                    request.error
                );

                reject(
                    request.error
                );

            };

    });

}


// ========================================
// إنشاء ID
// ========================================

function createId() {

    if (
        typeof crypto !== "undefined" &&
        crypto.randomUUID
    ) {

        return crypto.randomUUID();

    }

    return (
        Date.now().toString(36) +
        Math.random()
            .toString(36)
            .substring(2)
    );

}


// ========================================
// تنظيف النص
// ========================================

function cleanText(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }

    return String(value)

        .replace(/\u00A0/g, " ")

        .replace(/\r?\n/g, " ")

        .replace(/\s+/g, " ")

        .trim();

}


// ========================================
// توحيد النص
// ========================================

function normalizeText(value) {

    return cleanText(value)

        .toLowerCase()

        .replace(/[أإآ]/g, "ا")

        .replace(/ة/g, "ه")

        .replace(/ى/g, "ي")

        .replace(
            /[ًٌٍَُِّْـ]/g,
            ""
        )

        .trim();

}


// ========================================
// معرفة True
// ========================================

function isTrueValue(value) {

    const text =
        normalizeText(value);

    return [

        "true",
        "ture",
        "t",
        "صح",
        "صحيح",
        "yes",
        "1"

    ].includes(text);

}


// ========================================
// معرفة False
// ========================================

function isFalseValue(value) {

    const text =
        normalizeText(value);

    return [

        "false",
        "f",
        "غلط",
        "خطا",
        "خطأ",
        "غير صحيح",
        "no",
        "0"

    ].includes(text);

}


// ========================================
// التنقل
// ========================================

function showPage(pageId) {

    document
        .querySelectorAll(".page")
        .forEach(page => {

            page.classList.remove(
                "active"
            );

        });


    const page =
        document.getElementById(
            pageId
        );


    if (page) {

        page.classList.add(
            "active"
        );

    }

}


// ========================================
// جلب الملفات
// ========================================

function getAllFiles() {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    FILES_STORE,
                    "readonly"
                );


            const store =
                transaction.objectStore(
                    FILES_STORE
                );


            const request =
                store.getAll();


            request.onsuccess =
                function () {

                    resolve(
                        request.result || []
                    );

                };


            request.onerror =
                function () {

                    reject(
                        request.error
                    );

                };

        }
    );

}


// ========================================
// جلب كل الأسئلة
// ========================================

function getAllQuestions() {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    QUESTIONS_STORE,
                    "readonly"
                );


            const store =
                transaction.objectStore(
                    QUESTIONS_STORE
                );


            const request =
                store.getAll();


            request.onsuccess =
                function () {

                    resolve(
                        request.result || []
                    );

                };


            request.onerror =
                function () {

                    reject(
                        request.error
                    );

                };

        }
    );

}


// ========================================
// الأسئلة حسب الفلاتر
// ========================================

async function getFilteredQuestions(
    category = "",
    fileId = ""
) {

    let questions =
        await getAllQuestions();


    if (category) {

        questions =
            questions.filter(
                q =>
                    q.category === category
            );

    }


    if (fileId) {

        questions =
            questions.filter(
                q =>
                    q.fileId === fileId
            );

    }


    return questions;

}


// ========================================
// حفظ ملف وأسئلته
// ========================================

function saveFileWithQuestions(
    fileData,
    questions
) {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    [
                        FILES_STORE,
                        QUESTIONS_STORE
                    ],
                    "readwrite"
                );


            const filesStore =
                transaction.objectStore(
                    FILES_STORE
                );


            const questionsStore =
                transaction.objectStore(
                    QUESTIONS_STORE
                );


            filesStore.put(
                fileData
            );


            questions.forEach(
                question => {

                    questionsStore.put(
                        question
                    );

                }
            );


            transaction.oncomplete =
                function () {

                    resolve();

                };


            transaction.onerror =
                function () {

                    reject(
                        transaction.error
                    );

                };

        }
    );

}


// ========================================
// حذف ملف
// ========================================

function deleteFile(fileId) {

    if (
        !confirm(
            "⚠️ حذف الملف سيحذف كل الأسئلة الموجودة بداخله.\n\nهل أنت متأكد؟"
        )
    ) {

        return;

    }


    const transaction =
        db.transaction(
            [
                FILES_STORE,
                QUESTIONS_STORE
            ],
            "readwrite"
        );


    const filesStore =
        transaction.objectStore(
            FILES_STORE
        );


    const questionsStore =
        transaction.objectStore(
            QUESTIONS_STORE
        );


    filesStore.delete(
        fileId
    );


    const index =
        questionsStore.index(
            "fileId"
        );


    const request =
        index.openCursor(
            IDBKeyRange.only(fileId)
        );


    request.onsuccess =
        function (event) {

            const cursor =
                event.target.result;


            if (cursor) {

                cursor.delete();

                cursor.continue();

            }

        };


    transaction.oncomplete =
        function () {

            loadFiles();

            loadQuestions();

            loadQuizFilters();

            alert(
                "✅ تم حذف الملف وكل أسئلته"
            );

        };

}


// ========================================
// حذف سؤال
// ========================================

function deleteQuestion(questionId) {

    if (
        !confirm(
            "متأكد إنك عايز تحذف السؤال؟"
        )
    ) {

        return;

    }


    const transaction =
        db.transaction(
            QUESTIONS_STORE,
            "readwrite"
        );


    const store =
        transaction.objectStore(
            QUESTIONS_STORE
        );


    store.delete(
        questionId
    );


    transaction.oncomplete =
        function () {

            loadQuestions();

            alert(
                "✅ تم حذف السؤال"
            );

        };

}


// ========================================
// حماية النصوص
// ========================================

function escapeHTML(value) {

    return String(value || "")

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


// ========================================
// عرض الملفات
// ========================================

async function loadFiles() {

    const box =
        document.getElementById(
            "filesList"
        );


    if (!box) {
        return;
    }


    box.innerHTML =
        "<p>جاري تحميل الملفات...</p>";


    const files =
        await getAllFiles();


    if (!files.length) {

        box.innerHTML = `

            <div class="emptyMessage">

                📂 مفيش ملفات لسه.

                <br>

                استورد أول ملف Excel.

            </div>

        `;

        return;

    }


    files.sort(
        (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
    );


    const groups = {};


    files.forEach(file => {

        const category =
            file.category ||
            "غير مصنف";


        if (!groups[category]) {

            groups[category] = [];

        }


        groups[category].push(
            file
        );

    });


    box.innerHTML = "";


    Object.keys(groups)
        .sort()
        .forEach(category => {

            const group =
                document.createElement(
                    "div"
                );


            group.className =
                "categoryGroup";


            const title =
                document.createElement(
                    "div"
                );


            title.className =
                "categoryTitle";


            title.textContent =
                `📁 ${category}`;


            group.appendChild(
                title
            );


            groups[category].forEach(
                file => {

                    const card =
                        document.createElement(
                            "div"
                        );


                    card.className =
                        "fileCard";


                    card.innerHTML = `

                        <h3>
                            📄
                            ${escapeHTML(file.name)}
                        </h3>

                        <p>
                            📊 عدد الأسئلة:
                            <b>
                                ${file.questionCount}
                            </b>
                        </p>

                        <p>
                            📎 الملف الأصلي:
                            ${escapeHTML(
                                file.sourceFileName
                            )}
                        </p>

                        <button
                            class="delete"
                            onclick="deleteFile('${file.id}')"
                        >
                            🗑 حذف الملف
                        </button>

                    `;


                    group.appendChild(
                        card
                    );

                }
            );


            box.appendChild(
                group
            );

        });

}


// ========================================
// اختيار ملفات Excel
// ========================================

const excelInput =
    document.getElementById(
        "excelFiles"
    );


if (excelInput) {

    excelInput.addEventListener(
        "change",
        async function () {

            const files =
                Array.from(
                    this.files
                );


            const box =
                document.getElementById(
                    "selectedFiles"
                );


            box.innerHTML = "";


            if (!files.length) {

                return;

            }


            const existingFiles =
                await getAllFiles();


            const oldDataList =
                document.getElementById(
                    "categorySuggestions"
                );


            if (oldDataList) {

                oldDataList.remove();

            }


            files.forEach(
                (file, index) => {

                    const defaultName =
                        file.name.replace(
                            /\.(xlsx|xls|csv)$/i,
                            ""
                        );


                    const card =
                        document.createElement(
                            "div"
                        );


                    card.className =
                        "importFileCard";


                    card.innerHTML = `

                        <strong>
                            📄
                            ${escapeHTML(
                                file.name
                            )}
                        </strong>

                        <label>
                            اسم الملف داخل الموقع
                        </label>

                        <input
                            type="text"
                            class="importFileName"
                            data-index="${index}"
                            value="${escapeHTML(
                                defaultName
                            )}"
                            placeholder="مثال: محاضرة القلب 1"
                        >

                        <label>
                            التصنيف
                        </label>

                        <input
                            type="text"
                            class="importCategory"
                            data-index="${index}"
                            list="categorySuggestions"
                            placeholder="مثال: القلب"
                        >

                    `;


                    box.appendChild(
                        card
                    );

                }
            );


            const categories =
                [
                    ...new Set(
                        existingFiles
                            .map(
                                file =>
                                    file.category
                            )
                            .filter(Boolean)
                    )
                ];


            const dataList =
                document.createElement(
                    "datalist"
                );


            dataList.id =
                "categorySuggestions";


            categories.forEach(
                category => {

                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        category;


                    dataList.appendChild(
                        option
                    );

                }
            );


            document.body.appendChild(
                dataList
            );

        }
    );

}


// ========================================
// استيراد Excel
// ========================================

async function importExcel() {

    const input =
        document.getElementById(
            "excelFiles"
        );


    const result =
        document.getElementById(
            "importResult"
        );


    if (
        !input ||
        !input.files.length
    ) {

        alert(
            "اختار ملف Excel الأول"
        );

        return;

    }


    const files =
        Array.from(
            input.files
        );


    const nameInputs =
        document.querySelectorAll(
            ".importFileName"
        );


    const categoryInputs =
        document.querySelectorAll(
            ".importCategory"
        );


    let totalImported = 0;

    let totalFailed = 0;

    let totalDuplicated = 0;

    let details = [];


    for (
        let fileIndex = 0;
        fileIndex < files.length;
        fileIndex++
    ) {

        const file =
            files[fileIndex];


        const customName =
            cleanText(
                nameInputs[
                    fileIndex
                ]?.value
            );


        const category =
            cleanText(
                categoryInputs[
                    fileIndex
                ]?.value
            );


        if (!customName) {

            alert(
                `اكتب اسم الملف رقم ${fileIndex + 1}`
            );

            return;

        }


        if (!category) {

            alert(
                `اكتب تصنيف الملف رقم ${fileIndex + 1}`
            );

            return;

        }


        try {

            const data =
                await file.arrayBuffer();


            const workbook =
                XLSX.read(
                    data,
                    {
                        type: "array"
                    }
                );


            const fileId =
                createId();


            const importedQuestions =
                [];


            const questionsInThisFile =
                [];


            for (
                const sheetName
                of workbook.SheetNames
            ) {

                const sheet =
                    workbook.Sheets[
                        sheetName
                    ];


                const rows =
                    XLSX.utils.sheet_to_json(
                        sheet,
                        {
                            header: 1,
                            defval: "",
                            raw: false
                        }
                    );


                if (!rows.length) {
                    continue;
                }


                let startRow = 0;


                const firstRow =
                    rows[0]
                        .map(cleanText)
                        .join(" ")
                        .toLowerCase();


                if (
                    firstRow.includes(
                        "نص السؤال"
                    ) ||
                    firstRow.includes(
                        "السؤال"
                    ) ||
                    firstRow.includes(
                        "question"
                    )
                ) {

                    startRow = 1;

                }


                for (
                    let rowIndex = startRow;
                    rowIndex < rows.length;
                    rowIndex++
                ) {

                    const row =
                        rows[rowIndex];


                    if (!row) {
                        continue;
                    }


                    const type =
                        cleanText(
                            row[0]
                        );


                    const question =
                        cleanText(
                            row[1]
                        );


                    const explanation =
                        cleanText(
                            row[2]
                        );


                    const difficulty =
                        cleanText(
                            row[3]
                        );


                    const correctAnswer =
                        cleanText(
                            row[4]
                        );


                    const answerA =
                        cleanText(
                            row[5]
                        );


                    const answerB =
                        cleanText(
                            row[6]
                        );


                    const answerC =
                        cleanText(
                            row[7]
                        );


                    const answerD =
                        cleanText(
                            row[8]
                        );


                    if (!question) {
                        continue;
                    }


                    const duplicate =
                        questionsInThisFile.some(
                            q =>
                                normalizeText(
                                    q.question
                                ) ===
                                normalizeText(
                                    question
                                )
                        );


                    if (duplicate) {

                        totalDuplicated++;

                        continue;

                    }


                    const typeText =
                        normalizeText(
                            type
                        );


                    const isTrueFalse =
                        typeText.includes(
                            "true"
                        ) ||
                        typeText.includes(
                            "ture"
                        ) ||
                        typeText.includes(
                            "false"
                        ) ||
                        typeText.includes(
                            "صح"
                        ) ||
                        typeText.includes(
                            "غلط"
                        ) ||
                        typeText.includes(
                            "صواب"
                        ) ||
                        isTrueValue(
                            correctAnswer
                        ) ||
                        isFalseValue(
                            correctAnswer
                        );


                    // =========================
                    // صح وغلط
                    // =========================

                    if (isTrueFalse) {

                        let correct = -1;


                        if (
                            isTrueValue(
                                correctAnswer
                            )
                        ) {

                            correct = 0;

                        }

                        else if (
                            isFalseValue(
                                correctAnswer
                            )
                        ) {

                            correct = 1;

                        }


                        if (
                            correct === -1
                        ) {

                            totalFailed++;


                            details.push(
                                `${file.name} - الصف ${rowIndex + 1}: إجابة صح/غلط غير مفهومة: ${correctAnswer}`
                            );


                            continue;

                        }


                        const newQuestion = {

                            id:
                                createId(),

                            fileId:
                                fileId,

                            fileName:
                                customName,

                            category:
                                category,

                            type:
                                "truefalse",

                            question:
                                question,

                            explanation:
                                explanation,

                            difficulty:
                                difficulty,

                            answers: [
                                "صح",
                                "غلط"
                            ],

                            correct:
                                correct

                        };


                        importedQuestions.push(
                            newQuestion
                        );


                        questionsInThisFile.push(
                            newQuestion
                        );


                        totalImported++;

                        continue;

                    }


                    // =========================
                    // اختيار من متعدد
                    // =========================

                    let answers = [

                        answerA,
                        answerB,
                        answerC,
                        answerD

                    ];


                    while (
                        answers.length > 2 &&
                        !answers[
                            answers.length - 1
                        ]
                    ) {

                        answers.pop();

                    }


                    if (
                        answers.length < 2 ||
                        answers.some(
                            answer =>
                                !answer
                        )
                    ) {

                        totalFailed++;


                        details.push(
                            `${file.name} - الصف ${rowIndex + 1}: الاختيارات ناقصة`
                        );


                        continue;

                    }


                    const correct =
                        findCorrectAnswer(
                            correctAnswer,
                            answers
                        );


                    if (
                        correct === -1
                    ) {

                        totalFailed++;


                        details.push(
                            `${file.name} - الصف ${rowIndex + 1}: لم أفهم الإجابة الصحيحة "${correctAnswer}"`
                        );


                        continue;

                    }


                    const newQuestion = {

                        id:
                            createId(),

                        fileId:
                            fileId,

                        fileName:
                            customName,

                        category:
                            category,

                        type:
                            "mcq",

                        question:
                            question,

                        explanation:
                            explanation,

                        difficulty:
                            difficulty,

                        answers:
                            answers,

                        correct:
                            correct

                    };


                    importedQuestions.push(
                        newQuestion
                    );


                    questionsInThisFile.push(
                        newQuestion
                    );


                    totalImported++;

                }

            }


            const fileRecord = {

                id:
                    fileId,

                name:
                    customName,

                category:
                    category,

                sourceFileName:
                    file.name,

                questionCount:
                    importedQuestions.length,

                createdAt:
                    new Date().toISOString()

            };


            await saveFileWithQuestions(
                fileRecord,
                importedQuestions
            );

        }


        catch (error) {

            console.error(
                error
            );


            totalFailed++;


            details.push(
                `${file.name}: حدث خطأ أثناء قراءة الملف`
            );

        }

    }


    let detailsHTML = "";


    if (details.length) {

        detailsHTML = `

            <details>

                <summary>
                    🔎 عرض الأسئلة التي لم تُقرأ
                </summary>

                <div
                    style="
                        margin-top:10px;
                        max-height:300px;
                        overflow:auto;
                    "
                >

                    ${
                        details
                            .slice(0, 200)
                            .map(
                                item =>
                                    `<p>❌ ${escapeHTML(item)}</p>`
                            )
                            .join("")
                    }

                </div>

            </details>

        `;

    }


    result.innerHTML = `

        <div class="importSuccess">

            <h3>
                ✅ تم الانتهاء من الاستيراد
            </h3>

            <p>
                📥 تمت إضافة:
                <b>
                    ${totalImported}
                </b>
                سؤال
            </p>

            <p>
                🔁 مكرر داخل الملفات:
                <b>
                    ${totalDuplicated}
                </b>
            </p>

            <p>
                ❌ لم يتم قراءتها:
                <b>
                    ${totalFailed}
                </b>
            </p>

            ${detailsHTML}

        </div>

    `;


    await loadFiles();

    await loadQuestions();

    await loadQuizFilters();

}


// ========================================
// تحديد الإجابة الصحيحة
// ========================================

function findCorrectAnswer(
    correctValue,
    answers
) {

    const value =
        normalizeText(
            correctValue
        );


    if (!value) {
        return -1;
    }


    if (
        isTrueValue(value)
    ) {

        return 0;

    }


    if (
        isFalseValue(value)
    ) {

        return 1;

    }


    if (
        [
            "a",
            "اختيار ا",
            "الاختيار ا"
        ].includes(value)
    ) {

        return 0;

    }


    if (
        [
            "b",
            "اختيار ب",
            "الاختيار ب"
        ].includes(value)
    ) {

        return 1;

    }


    if (
        [
            "c",
            "اختيار ج",
            "الاختيار ج"
        ].includes(value)
    ) {

        return 2;

    }


    if (
        [
            "d",
            "اختيار د",
            "الاختيار د"
        ].includes(value)
    ) {

        return 3;

    }


    if (value === "1") return 0;

    if (value === "2") return 1;

    if (value === "3") return 2;

    if (value === "4") return 3;


    if (
        value === "الاولي" ||
        value === "الاولى"
    ) {

        return 0;

    }


    if (
        value === "الثانيه"
    ) {

        return 1;

    }


    if (
        value === "الثالثه"
    ) {

        return 2;

    }


    if (
        value === "الرابعه"
    ) {

        return 3;

    }


    for (
        let i = 0;
        i < answers.length;
        i++
    ) {

        if (
            normalizeText(
                answers[i]
            ) === value
        ) {

            return i;

        }

    }


    return -1;

}


// ========================================
// التصنيفات
// ========================================

async function getCategories() {

    const files =
        await getAllFiles();


    return [
        ...new Set(
            files
                .map(
                    file =>
                        file.category
                )
                .filter(Boolean)
        )
    ].sort();

}


// ========================================
// تحميل قائمة التصنيفات
// ========================================

async function loadCategorySelect(
    selectId
) {

    const select =
        document.getElementById(
            selectId
        );


    if (!select) {
        return;
    }


    const categories =
        await getCategories();


    const currentValue =
        select.value;


    select.innerHTML = `

        <option value="">
            كل التصنيفات
        </option>

    `;


    categories.forEach(
        category => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                category;


            option.textContent =
                category;


            select.appendChild(
                option
            );

        }
    );


    if (
        categories.includes(
            currentValue
        )
    ) {

        select.value =
            currentValue;

    }

}


// ========================================
// فلترة ملفات بنك الأسئلة
// ========================================

async function filterQuestionFiles() {

    const category =
        document.getElementById(
            "questionCategoryFilter"
        ).value;


    const fileSelect =
        document.getElementById(
            "questionFileFilter"
        );


    const files =
        await getAllFiles();


    const filtered =
        category

            ? files.filter(
                file =>
                    file.category === category
            )

            : files;


    fileSelect.innerHTML = `

        <option value="">
            كل الملفات
        </option>

    `;


    filtered.forEach(
        file => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                file.id;


            option.textContent =
                file.name;


            fileSelect.appendChild(
                option
            );

        }
    );


    await loadQuestions();

}


// ========================================
// تحميل بنك الأسئلة
// ========================================

async function loadQuestions() {

    const list =
        document.getElementById(
            "questionsList"
        );


    const count =
        document.getElementById(
            "questionsCount"
        );


    if (!list || !count) {
        return;
    }


    const category =
        document.getElementById(
            "questionCategoryFilter"
        )?.value || "";


    const fileId =
        document.getElementById(
            "questionFileFilter"
        )?.value || "";


    const questions =
        await getFilteredQuestions(
            category,
            fileId
        );


    count.textContent =
        questions.length;


    list.innerHTML = "";


    if (!questions.length) {

        list.innerHTML = `

            <div class="emptyMessage">

                📭 مفيش أسئلة في الاختيار ده.

            </div>

        `;

        return;

    }


    questions.forEach(
        (q, index) => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "questionCard";


            card.innerHTML = `

                <h3>

                    ${index + 1}.

                    ${escapeHTML(
                        q.question
                    )}

                </h3>

                <p class="meta">

                    📁 الملف:

                    ${escapeHTML(
                        q.fileName
                    )}

                </p>

                <p class="meta">

                    🏷️ التصنيف:

                    ${escapeHTML(
                        q.category
                    )}

                </p>

                ${
                    q.difficulty
                        ? `
                            <p>
                                📊 الصعوبة:
                                ${escapeHTML(
                                    q.difficulty
                                )}
                            </p>
                        `
                        : ""
                }

                <button
                    class="delete"
                    onclick="deleteQuestion('${q.id}')"
                >

                    🗑 حذف السؤال

                </button>

            `;


            list.appendChild(
                card
            );

        }
    );

}


// ========================================
// فلترة ملفات الاختبار
// ========================================

async function filterQuizFiles() {

    const category =
        document.getElementById(
            "quizCategory"
        ).value;


    const fileSelect =
        document.getElementById(
            "quizFile"
        );


    const files =
        await getAllFiles();


    const filtered =
        category

            ? files.filter(
                file =>
                    file.category === category
            )

            : files;


    fileSelect.innerHTML = `

        <option value="">
            كل الملفات
        </option>

    `;


    filtered.forEach(
        file => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                file.id;


            option.textContent =
                file.name;


            fileSelect.appendChild(
                option
            );

        }
    );

}


// ========================================
// تحميل فلاتر الاختبار
// ========================================

async function loadQuizFilters() {

    await loadCategorySelect(
        "quizCategory"
    );


    await filterQuizFiles();

}


// ========================================
// بدء الاختبار
// ========================================

async function startQuiz() {

    const category =
        document.getElementById(
            "quizCategory"
        ).value;


    const fileId =
        document.getElementById(
            "quizFile"
        ).value;


    let count =
        Number(
            document.getElementById(
                "quizCount"
            ).value
        );


    let questions =
        await getFilteredQuestions(
            category,
            fileId
        );


    if (!questions.length) {

        alert(
            "مفيش أسئلة في الاختيار ده"
        );

        return;

    }


    questions.sort(
        () =>
            Math.random() - 0.5
    );


    if (
        !count ||
        count < 1
    ) {

        count =
            questions.length;

    }


    count =
        Math.min(
            count,
            questions.length
        );


    currentQuizQuestions =
        questions.slice(
            0,
            count
        );


    currentQuestionIndex =
        0;


    currentScore =
        0;


    answered =
        false;


    solvedQuestions =
        new Set();


    // تصفير إجابات المستخدم
    userAnswers = {};


    document.getElementById(
        "totalQuestions"
    ).textContent =
        currentQuizQuestions.length;


    renderQuestionNumbers();


    showPage(
        "quizPage"
    );


    displayQuizQuestion();

}


// ========================================
// رسم أرقام الأسئلة
// ========================================

function renderQuestionNumbers() {

    const box =
        document.getElementById(
            "questionNumbersList"
        );


    if (!box) {
        return;
    }


    box.innerHTML = "";


    currentQuizQuestions.forEach(
        (question, index) => {

            const button =
                document.createElement(
                    "button"
                );


            button.className =
                "questionNumberButton";


            button.textContent =
                index + 1;


            if (
                index ===
                currentQuestionIndex
            ) {

                button.classList.add(
                    "current"
                );

            }


            if (
                solvedQuestions.has(
                    index
                )
            ) {

                button.classList.add(
                    "solved"
                );

            }


            button.onclick =
                function () {

                    goToQuestion(
                        index
                    );

                };


            box.appendChild(
                button
            );

        }
    );

}


// ========================================
// الانتقال لسؤال معين
// ========================================

function goToQuestion(index) {

    if (
        index < 0 ||
        index >=
        currentQuizQuestions.length
    ) {

        return;

    }


    currentQuestionIndex =
        index;


    displayQuizQuestion();

}


// ========================================
// عرض سؤال الاختبار
// ========================================

function displayQuizQuestion() {

    const q =
        currentQuizQuestions[
            currentQuestionIndex
        ];


    if (!q) {
        return;
    }


    answered =
        solvedQuestions.has(
            currentQuestionIndex
        );


    document.getElementById(
        "questionNumber"
    ).textContent =
        currentQuestionIndex + 1;


    document.getElementById(
        "totalQuestions"
    ).textContent =
        currentQuizQuestions.length;


    document.getElementById(
        "score"
    ).textContent =
        currentScore;


    document.getElementById(
        "questionText"
    ).textContent =
        q.question;


    const answersBox =
        document.getElementById(
            "answers"
        );


    answersBox.innerHTML = "";


    q.answers.forEach(
        (answer, index) => {

            const button =
                document.createElement(
                    "button"
                );


            button.className =
                "answerButton";


            button.textContent =
                answer;


            button.onclick =
                function () {

                    chooseAnswer(
                        index
                    );

                };


            answersBox.appendChild(
                button
            );

        }
    );


    document.getElementById(
        "nextQuestion"
    ).textContent =

        currentQuestionIndex ===
        currentQuizQuestions.length - 1

            ? "إنهاء الاختبار"

            : "السؤال التالي";


    renderQuestionNumbers();


    // لو السؤال اتحل قبل كده
    // نظهر الإجابة الصحيحة وإجابة المستخدم

    if (answered) {

        const buttons =
            document.querySelectorAll(
                ".answerButton"
            );


        const previousAnswer =
            userAnswers[
                currentQuestionIndex
            ];


        buttons.forEach(
            (button, i) => {

                if (
                    i === q.correct
                ) {

                    button.classList.add(
                        "correct"
                    );

                }


                if (
                    i === previousAnswer &&
                    i !== q.correct
                ) {

                    button.classList.add(
                        "wrong"
                    );

                }

            }
        );


        if (
            q.explanation
        ) {

            showExplanation(
                q.explanation
            );

        }

    }

}


// ========================================
// اختيار الإجابة
// ========================================

function chooseAnswer(index) {

    if (answered) {
        return;
    }


    answered =
        true;


    solvedQuestions.add(
        currentQuestionIndex
    );


    // حفظ إجابة المستخدم
    userAnswers[
        currentQuestionIndex
    ] = index;


    const q =
        currentQuizQuestions[
            currentQuestionIndex
        ];


    const buttons =
        document.querySelectorAll(
            ".answerButton"
        );


    buttons.forEach(
        (button, i) => {

            if (
                i === q.correct
            ) {

                button.classList.add(
                    "correct"
                );

            }


            if (
                i === index &&
                i !== q.correct
            ) {

                button.classList.add(
                    "wrong"
                );

            }

        }
    );


    if (
        index === q.correct
    ) {

        currentScore++;

        document.getElementById(
            "score"
        ).textContent =
            currentScore;

    }


    renderQuestionNumbers();


    if (
        q.explanation
    ) {

        showExplanation(
            q.explanation
        );

    }

}


// ========================================
// عرض الشرح
// ========================================

function showExplanation(
    explanationText
) {

    const explanation =
        document.createElement(
            "div"
        );


    explanation.className =
        "explanationBox";


    explanation.innerHTML = `

        <strong>
            💡 الشرح والتفسير:
        </strong>

        <p>
            ${escapeHTML(
                explanationText
            )}
        </p>

    `;


    document
        .getElementById(
            "answers"
        )
        .appendChild(
            explanation
        );

}


// ========================================
// السؤال التالي
// ========================================

function nextQuestion() {

    if (!answered) {

        // السماح بالتخطي

        currentQuestionIndex++;


        if (
            currentQuestionIndex >=
            currentQuizQuestions.length
        ) {

            showResult();

            return;

        }


        displayQuizQuestion();

        return;

    }


    currentQuestionIndex++;


    if (
        currentQuestionIndex >=
        currentQuizQuestions.length
    ) {

        showResult();

        return;

    }


    displayQuizQuestion();

}


// ========================================
// النتيجة
// ========================================

function showResult() {

    showPage(
        "resultPage"
    );


    const total =
        currentQuizQuestions.length;


    document.getElementById(
        "finalScore"
    ).textContent =
        `${currentScore} / ${total}`;


    // ========================================
    // حساب الإحصائيات
    // ========================================

    const answeredCount =
        Object.keys(
            userAnswers
        ).length;


    const unansweredCount =
        total -
        answeredCount;


    const wrongCount =
        answeredCount -
        currentScore;


    const percentage =
        total

            ? Math.round(
                (
                    currentScore /
                    total
                ) * 100
            )

            : 0;


    let message;


    if (
        percentage >= 90
    ) {

        message =
            "🔥 ممتاز جدًا!";

    }

    else if (
        percentage >= 75
    ) {

        message =
            "👏 ممتاز!";

    }

    else if (
        percentage >= 50
    ) {

        message =
            "👍 كويس، محتاج شوية مراجعة.";

    }

    else {

        message =
            "💪 محتاج تراجع أكتر.";

    }


    document.getElementById(
        "resultMessage"
    ).innerHTML = `

        ${message}

        <br>

        <b>
            النسبة المئوية: ${percentage}%
        </b>

        <br>

        <span>
            ✅ صح: ${currentScore}
            &nbsp; | &nbsp;
            ❌ غلط: ${wrongCount}
            ${
                unansweredCount > 0
                    ? `
                        &nbsp; | &nbsp;
                        ⚪ بدون إجابة: ${unansweredCount}
                    `
                    : ""
            }
        </span>

    `;


    // ========================================
    // عرض الأسئلة الغلط
    // ========================================

    const wrongAnswersBox =
        document.getElementById(
            "wrongAnswers"
        );


    if (!wrongAnswersBox) {
        return;
    }


    const wrongQuestions =
        currentQuizQuestions.filter(
            (question, index) => {

                const selectedAnswer =
                    userAnswers[index];


                return (
                    selectedAnswer !== undefined &&
                    selectedAnswer !== question.correct
                );

            }
        );


    // لو مفيش أي سؤال غلط

    if (!wrongQuestions.length) {

        wrongAnswersBox.innerHTML = `

            <div class="noWrongAnswers">

                🎉 ممتاز!

                <br>

                مفيش أي إجابات غلط.

            </div>

        `;

        return;

    }


    let wrongHTML = `

        <div class="wrongAnswersTitle">

            ❌ مراجعة الإجابات الغلط

            <br>

            <small>
                عدد الأسئلة الغلط: ${wrongQuestions.length}
            </small>

        </div>

    `;


    currentQuizQuestions.forEach(
        (question, index) => {

            const selectedAnswer =
                userAnswers[index];


            if (
                selectedAnswer === undefined ||
                selectedAnswer === question.correct
            ) {

                return;

            }


            const yourAnswer =
                question.answers[
                    selectedAnswer
                ];


            const correctAnswer =
                question.answers[
                    question.correct
                ];


            wrongHTML += `

                <div class="wrongAnswerCard">

                    <div class="wrongQuestion">

                        السؤال ${index + 1}:

                        <br>

                        ${escapeHTML(
                            question.question
                        )}

                    </div>


                    <div class="yourAnswer">

                        ❌ إجابتك:

                        <b>
                            ${escapeHTML(
                                yourAnswer
                            )}
                        </b>

                    </div>


                    <div class="correctAnswer">

                        ✅ الإجابة الصحيحة:

                        <b>
                            ${escapeHTML(
                                correctAnswer
                            )}
                        </b>

                    </div>


                    ${
                        question.explanation
                            ? `
                                <div
                                    class="resultExplanation"
                                >

                                    💡

                                    <b>
                                        الشرح:
                                    </b>

                                    ${escapeHTML(
                                        question.explanation
                                    )}

                                </div>
                            `
                            : ""
                    }

                </div>

            `;

        }
    );


    wrongAnswersBox.innerHTML =
        wrongHTML;

}


// ========================================
// تشغيل الموقع
// ========================================

async function initializeApp() {

    try {

        await openDatabase();


        await loadCategorySelect(
            "questionCategoryFilter"
        );


        await filterQuestionFiles();


        await loadQuizFilters();


        console.log(
            "🚀 الموقع جاهز"
        );

    }

    catch (error) {

        console.error(
            error
        );


        alert(
            "❌ حصل خطأ في تشغيل قاعدة البيانات"
        );

    }

}


initializeApp();