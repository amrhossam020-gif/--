// ========================================
// إعداد قاعدة البيانات
// ========================================

const DB_NAME = "QuizDatabase";
const DB_VERSION = 1;

const FILES_STORE = "files";
const QUESTIONS_STORE = "questions";

const BACKUP_FILE = "./quiz-database.json";

let db = null;

let currentQuizQuestions = [];
let currentQuestionIndex = 0;
let currentScore = 0;
let answered = false;
let solvedQuestions = new Set();
let userAnswers = {};


// ========================================
// فتح قاعدة البيانات
// ========================================

function openDatabase() {
    return new Promise((resolve, reject) => {

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = function (event) {

            const database = event.target.result;

            if (!database.objectStoreNames.contains(FILES_STORE)) {

                const filesStore = database.createObjectStore(
                    FILES_STORE,
                    { keyPath: "id" }
                );

                filesStore.createIndex(
                    "category",
                    "category",
                    { unique: false }
                );

                filesStore.createIndex(
                    "createdAt",
                    "createdAt",
                    { unique: false }
                );
            }

            if (!database.objectStoreNames.contains(QUESTIONS_STORE)) {

                const questionsStore = database.createObjectStore(
                    QUESTIONS_STORE,
                    { keyPath: "id" }
                );

                questionsStore.createIndex(
                    "fileId",
                    "fileId",
                    { unique: false }
                );

                questionsStore.createIndex(
                    "category",
                    "category",
                    { unique: false }
                );
            }
        };

        request.onsuccess = function (event) {

            db = event.target.result;

            console.log("✅ قاعدة البيانات جاهزة");

            resolve(db);
        };

        request.onerror = function () {

            console.error(
                "❌ خطأ في قاعدة البيانات",
                request.error
            );

            reject(request.error);
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
        Math.random().toString(36).substring(2)
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
        .replace(/[ًٌٍَُِّْـ]/g, "")
        .trim();
}


// ========================================
// معرفة True
// ========================================

function isTrueValue(value) {

    const text = normalizeText(value);

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

    const text = normalizeText(value);

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
            page.classList.remove("active");
        });

    const page = document.getElementById(pageId);

    if (page) {
        page.classList.add("active");
    }
}


// ========================================
// جلب الملفات
// ========================================

function getAllFiles() {

    return new Promise((resolve, reject) => {

        const transaction = db.transaction(
            FILES_STORE,
            "readonly"
        );

        const store = transaction.objectStore(
            FILES_STORE
        );

        const request = store.getAll();

        request.onsuccess = function () {
            resolve(request.result || []);
        };

        request.onerror = function () {
            reject(request.error);
        };
    });
}


// ========================================
// جلب كل الأسئلة
// ========================================

function getAllQuestions() {

    return new Promise((resolve, reject) => {

        const transaction = db.transaction(
            QUESTIONS_STORE,
            "readonly"
        );

        const store = transaction.objectStore(
            QUESTIONS_STORE
        );

        const request = store.getAll();

        request.onsuccess = function () {
            resolve(request.result || []);
        };

        request.onerror = function () {
            reject(request.error);
        };
    });
}


// ========================================
// الأسئلة حسب الفلاتر
// ========================================

async function getFilteredQuestions(
    category = "",
    fileId = ""
) {

    let questions = await getAllQuestions();

    if (category) {
        questions = questions.filter(
            q => q.category === category
        );
    }

    if (fileId) {
        questions = questions.filter(
            q => q.fileId === fileId
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

    return new Promise((resolve, reject) => {

        const transaction = db.transaction(
            [
                FILES_STORE,
                QUESTIONS_STORE
            ],
            "readwrite"
        );

        const filesStore =
            transaction.objectStore(FILES_STORE);

        const questionsStore =
            transaction.objectStore(QUESTIONS_STORE);

        filesStore.put(fileData);

        questions.forEach(question => {
            questionsStore.put(question);
        });

        transaction.oncomplete = function () {
            resolve();
        };

        transaction.onerror = function () {
            reject(transaction.error);
        };
    });
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

    const transaction = db.transaction(
        [
            FILES_STORE,
            QUESTIONS_STORE
        ],
        "readwrite"
    );

    const filesStore =
        transaction.objectStore(FILES_STORE);

    const questionsStore =
        transaction.objectStore(QUESTIONS_STORE);

    filesStore.delete(fileId);

    const index =
        questionsStore.index("fileId");

    const request =
        index.openCursor(
            IDBKeyRange.only(fileId)
        );

    request.onsuccess = function (event) {

        const cursor = event.target.result;

        if (cursor) {

            cursor.delete();
            cursor.continue();
        }
    };

    transaction.oncomplete = function () {

        loadFiles();
        loadQuestions();
        loadQuizFilters();

        alert("✅ تم حذف الملف وكل أسئلته");
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

    store.delete(questionId);

    transaction.oncomplete = function () {

        loadQuestions();

        alert("✅ تم حذف السؤال");
    };
}


// ========================================
// حماية النصوص
// ========================================

function escapeHTML(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ========================================
// عرض الملفات
// ========================================

async function loadFiles() {

    const box =
        document.getElementById("filesList");

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
            file.category || "غير مصنف";

        if (!groups[category]) {
            groups[category] = [];
        }

        groups[category].push(file);
    });

    box.innerHTML = "";

    Object.keys(groups)
        .sort()
        .forEach(category => {

            const group =
                document.createElement("div");

            group.className =
                "categoryGroup";

            const title =
                document.createElement("div");

            title.className =
                "categoryTitle";

            title.textContent =
                `📁 ${category}`;

            group.appendChild(title);

            groups[category].forEach(file => {

                const card =
                    document.createElement("div");

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

                group.appendChild(card);
            });

            box.appendChild(group);
        });
}


// ========================================
// اختيار ملفات Excel
// ========================================

function setupExcelInput() {

    const excelInput =
        document.getElementById("excelFiles");

    if (!excelInput) {
        return;
    }

    excelInput.addEventListener(
        "change",
        async function () {

            const files =
                Array.from(this.files);

            const box =
                document.getElementById(
                    "selectedFiles"
                );

            if (!box) {
                return;
            }

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

            files.forEach((file, index) => {

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
                        ${escapeHTML(file.name)}
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

                box.appendChild(card);
            });

            const categories = [
                ...new Set(
                    existingFiles
                        .map(file => file.category)
                        .filter(Boolean)
                )
            ];

            const dataList =
                document.createElement("datalist");

            dataList.id =
                "categorySuggestions";

            categories.forEach(category => {

                const option =
                    document.createElement("option");

                option.value = category;

                dataList.appendChild(option);
            });

            document.body.appendChild(dataList);
        }
    );
}


// ========================================
// استيراد Excel
// ========================================

async function importExcel() {

    const input =
        document.getElementById("excelFiles");

    const result =
        document.getElementById("importResult");

    if (
        !input ||
        !input.files.length
    ) {

        alert("اختار ملف Excel الأول");

        return;
    }

    const files =
        Array.from(input.files);

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
                nameInputs[fileIndex]?.value
            );

        const category =
            cleanText(
                categoryInputs[fileIndex]?.value
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

            const importedQuestions = [];
            const questionsInThisFile = [];

            for (
                const sheetName of workbook.SheetNames
            ) {

                const sheet =
                    workbook.Sheets[sheetName];

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
                    firstRow.includes("نص السؤال") ||
                    firstRow.includes("السؤال") ||
                    firstRow.includes("question")
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
                        cleanText(row[0]);

                    const question =
                        cleanText(row[1]);

                    const explanation =
                        cleanText(row[2]);

                    const difficulty =
                        cleanText(row[3]);

                    const correctAnswer =
                        cleanText(row[4]);

                    const answerA =
                        cleanText(row[5]);

                    const answerB =
                        cleanText(row[6]);

                    const answerC =
                        cleanText(row[7]);

                    const answerD =
                        cleanText(row[8]);

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
                        normalizeText(type);

                    const isTrueFalse =
                        typeText.includes("true") ||
                        typeText.includes("ture") ||
                        typeText.includes("false") ||
                        typeText.includes("صح") ||
                        typeText.includes("غلط") ||
                        typeText.includes("صواب") ||
                        isTrueValue(correctAnswer) ||
                        isFalseValue(correctAnswer);

                    // صح وغلط
                    if (isTrueFalse) {

                        let correct = -1;

                        if (
                            isTrueValue(correctAnswer)
                        ) {
                            correct = 0;
                        }

                        else if (
                            isFalseValue(correctAnswer)
                        ) {
                            correct = 1;
                        }

                        if (correct === -1) {

                            totalFailed++;

                            details.push(
                                `${file.name} - الصف ${rowIndex + 1}: إجابة صح/غلط غير مفهومة: ${correctAnswer}`
                            );

                            continue;
                        }

                        const newQuestion = {

                            id: createId(),

                            fileId: fileId,

                            fileName: customName,

                            category: category,

                            type: "truefalse",

                            question: question,

                            explanation: explanation,

                            difficulty: difficulty,

                            answers: [
                                "صح",
                                "غلط"
                            ],

                            correct: correct
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

                    // اختيار من متعدد
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
                            answer => !answer
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

                    if (correct === -1) {

                        totalFailed++;

                        details.push(
                            `${file.name} - الصف ${rowIndex + 1}: لم أفهم الإجابة الصحيحة "${correctAnswer}"`
                        );

                        continue;
                    }

                    const newQuestion = {

                        id: createId(),

                        fileId: fileId,

                        fileName: customName,

                        category: category,

                        type: "mcq",

                        question: question,

                        explanation: explanation,

                        difficulty: difficulty,

                        answers: answers,

                        correct: correct
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

                id: fileId,

                name: customName,

                category: category,

                sourceFileName: file.name,

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

            console.error(error);

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

    if (result) {

        result.innerHTML = `

            <div class="importSuccess">

                <h3>
                    ✅ تم الانتهاء من الاستيراد
                </h3>

                <p>
                    📥 تمت إضافة:
                    <b>${totalImported}</b>
                    سؤال
                </p>

                <p>
                    🔁 مكرر داخل الملفات:
                    <b>${totalDuplicated}</b>
                </p>

                <p>
                    ❌ لم يتم قراءتها:
                    <b>${totalFailed}</b>
                </p>

                ${detailsHTML}

            </div>
        `;
    }

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
        normalizeText(correctValue);

    if (!value) {
        return -1;
    }

    if (isTrueValue(value)) {
        return 0;
    }

    if (isFalseValue(value)) {
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
        value === "الثانيه" ||
        value === "الثانية"
    ) {
        return 1;
    }

    if (
        value === "الثالثه" ||
        value === "الثالثة"
    ) {
        return 2;
    }

    if (
        value === "الرابعه" ||
        value === "الرابعة"
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
                .map(file => file.category)
                .filter(Boolean)
        )
    ].sort();
}


// ========================================
// تحميل قائمة التصنيفات
// ========================================

async function loadCategorySelect(selectId) {

    const select =
        document.getElementById(selectId);

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

    categories.forEach(category => {

        const option =
            document.createElement("option");

        option.value = category;
        option.textContent = category;

        select.appendChild(option);
    });

    if (
        categories.includes(currentValue)
    ) {
        select.value = currentValue;
    }
}


// ========================================
// فلترة ملفات بنك الأسئلة
// ========================================

async function filterQuestionFiles() {

    const category =
        document.getElementById(
            "questionCategoryFilter"
        )?.value || "";

    const fileSelect =
        document.getElementById(
            "questionFileFilter"
        );

    if (!fileSelect) {
        return;
    }

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

    filtered.forEach(file => {

        const option =
            document.createElement("option");

        option.value = file.id;
        option.textContent = file.name;

        fileSelect.appendChild(option);
    });

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

    questions.forEach((q, index) => {

        const card =
            document.createElement("div");

        card.className =
            "questionCard";

        card.innerHTML = `

            <h3>

                ${index + 1}.

                ${escapeHTML(q.question)}

            </h3>

            <p class="meta">

                📁 الملف:

                ${escapeHTML(q.fileName)}

            </p>

            <p class="meta">

                🏷️ التصنيف:

                ${escapeHTML(q.category)}

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

        list.appendChild(card);
    });
}


// ========================================
// فلترة ملفات الاختبار
// ========================================

async function filterQuizFiles() {

    const category =
        document.getElementById(
            "quizCategory"
        )?.value || "";

    const fileSelect =
        document.getElementById(
            "quizFile"
        );

    if (!fileSelect) {
        return;
    }

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

    filtered.forEach(file => {

        const option =
            document.createElement("option");

        option.value = file.id;
        option.textContent = file.name;

        fileSelect.appendChild(option);
    });
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
        )?.value || "";

    const fileId =
        document.getElementById(
            "quizFile"
        )?.value || "";

    let count =
        Number(
            document.getElementById(
                "quizCount"
            )?.value
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
        () => Math.random() - 0.5
    );

    if (!count || count < 1) {
        count = questions.length;
    }

    count =
        Math.min(
            count,
            questions.length
        );

    currentQuizQuestions =
        questions.slice(0, count);

    currentQuestionIndex = 0;
    currentScore = 0;
    answered = false;
    solvedQuestions = new Set();
    userAnswers = {};

    const totalQuestions =
        document.getElementById(
            "totalQuestions"
        );

    if (totalQuestions) {
        totalQuestions.textContent =
            currentQuizQuestions.length;
    }

    renderQuestionNumbers();

    showPage("quizPage");

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
                index === currentQuestionIndex
            ) {
                button.classList.add("current");
            }

            if (
                solvedQuestions.has(index)
            ) {
                button.classList.add("solved");
            }

            button.onclick = function () {

                goToQuestion(index);
            };

            box.appendChild(button);
        }
    );
}


// ========================================
// الانتقال لسؤال معين
// ========================================

function goToQuestion(index) {

    if (
        index < 0 ||
        index >= currentQuizQuestions.length
    ) {
        return;
    }

    currentQuestionIndex = index;

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

    const questionNumber =
        document.getElementById(
            "questionNumber"
        );

    const totalQuestions =
        document.getElementById(
            "totalQuestions"
        );

    const score =
        document.getElementById("score");

    const questionText =
        document.getElementById(
            "questionText"
        );

    if (questionNumber) {
        questionNumber.textContent =
            currentQuestionIndex + 1;
    }

    if (totalQuestions) {
        totalQuestions.textContent =
            currentQuizQuestions.length;
    }

    if (score) {
        score.textContent =
            currentScore;
    }

    if (questionText) {
        questionText.textContent =
            q.question;
    }

    const answersBox =
        document.getElementById(
            "answers"
        );

    if (!answersBox) {
        return;
    }

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
                    chooseAnswer(index);
                };

            answersBox.appendChild(button);
        }
    );

    const nextButton =
        document.getElementById(
            "nextQuestion"
        );

    if (nextButton) {

        nextButton.textContent =

            currentQuestionIndex ===
            currentQuizQuestions.length - 1

                ? "إنهاء الاختبار"

                : "السؤال التالي";
    }

    renderQuestionNumbers();

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

        if (q.explanation) {

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

    answered = true;

    solvedQuestions.add(
        currentQuestionIndex
    );

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

            if (i === q.correct) {

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

    if (index === q.correct) {

        currentScore++;

        const score =
            document.getElementById(
                "score"
            );

        if (score) {
            score.textContent =
                currentScore;
        }
    }

    renderQuestionNumbers();

    if (q.explanation) {

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

    const answers =
        document.getElementById(
            "answers"
        );

    if (!answers) {
        return;
    }

    // منع تكرار الشرح
    const oldExplanation =
        answers.querySelector(
            ".explanationBox"
        );

    if (oldExplanation) {
        oldExplanation.remove();
    }

    const explanation =
        document.createElement("div");

    explanation.className =
        "explanationBox";

    explanation.innerHTML = `

        <strong>
            💡 الشرح والتفسير:
        </strong>

        <p>
            ${escapeHTML(explanationText)}
        </p>

    `;

    answers.appendChild(
        explanation
    );
}


// ========================================
// السؤال التالي
// ========================================

function nextQuestion() {

    if (!answered) {

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

    showPage("resultPage");

    const total =
        currentQuizQuestions.length;

    const finalScore =
        document.getElementById(
            "finalScore"
        );

    if (finalScore) {

        finalScore.textContent =
            `${currentScore} / ${total}`;
    }

    const answeredCount =
        Object.keys(userAnswers).length;

    const unansweredCount =
        total - answeredCount;

    const wrongCount =
        answeredCount - currentScore;

    const percentage =
        total
            ? Math.round(
                (currentScore / total) * 100
            )
            : 0;

    let message;

    if (percentage >= 90) {
        message = "🔥 ممتاز جدًا!";
    }

    else if (percentage >= 75) {
        message = "👏 ممتاز!";
    }

    else if (percentage >= 50) {
        message =
            "👍 كويس، محتاج شوية مراجعة.";
    }

    else {
        message =
            "💪 محتاج تراجع أكتر.";
    }

    const resultMessage =
        document.getElementById(
            "resultMessage"
        );

    if (resultMessage) {

        resultMessage.innerHTML = `

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
                            ⚪ بدون إجابة:
                            ${unansweredCount}
                        `
                        : ""
                }

            </span>

        `;
    }

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
                عدد الأسئلة الغلط:
                ${wrongQuestions.length}
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


// ==================================================
// 🔥 نظام نقل قاعدة البيانات
// ==================================================


// ========================================
// عدّ البيانات الموجودة
// ========================================

async function getDatabaseStats() {

    const files =
        await getAllFiles();

    const questions =
        await getAllQuestions();

    return {
        files: files.length,
        questions: questions.length
    };
}


// ========================================
// تصدير قاعدة البيانات
// ========================================

async function exportDatabase() {

    try {

        const files =
            await getAllFiles();

        const questions =
            await getAllQuestions();

        if (
            !files.length &&
            !questions.length
        ) {

            alert(
                "⚠️ مفيش بيانات في قاعدة البيانات لتصديرها."
            );

            return;
        }

        const backup = {

            backupVersion: 1,

            exportedAt:
                new Date().toISOString(),

            files: files,

            questions: questions
        };

        const json =
            JSON.stringify(
                backup,
                null,
                2
            );

        const blob =
            new Blob(
                [json],
                {
                    type:
                        "application/json"
                }
            );

        const url =
            URL.createObjectURL(blob);

        const link =
            document.createElement("a");

        link.href = url;

        link.download =
            "quiz-database.json";

        document.body.appendChild(link);

        link.click();

        link.remove();

        URL.revokeObjectURL(url);

        alert(`

✅ تم تصدير قاعدة البيانات بنجاح!

📁 الملفات: ${files.length}

❓ الأسئلة: ${questions.length}

الملف اسمه:
quiz-database.json

احتفظ بالملف ده.

`);

    }

    catch (error) {

        console.error(
            "Export error:",
            error
        );

        alert(
            "❌ حصل خطأ أثناء تصدير قاعدة البيانات."
        );
    }
}


// ========================================
// استيراد قاعدة البيانات
// ========================================

async function importDatabaseData(
    backup,
    replaceExisting = true,
    silent = false
) {

    if (!backup) {
        throw new Error(
            "ملف النسخة الاحتياطية فارغ."
        );
    }

    if (
        !Array.isArray(backup.files) ||
        !Array.isArray(backup.questions)
    ) {

        throw new Error(
            "صيغة ملف قاعدة البيانات غير صحيحة."
        );
    }

    const files =
        backup.files;

    const questions =
        backup.questions;

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

            transaction.onerror =
                function () {

                    reject(
                        transaction.error ||
                        new Error(
                            "فشل استيراد قاعدة البيانات"
                        )
                    );
                };

            transaction.oncomplete =
                function () {

                    resolve({
                        files:
                            files.length,

                        questions:
                            questions.length
                    });
                };

            if (replaceExisting) {

                filesStore.clear();

                questionsStore.clear();
            }

            files.forEach(file => {

                if (
                    file &&
                    file.id
                ) {

                    filesStore.put(file);
                }
            });

            questions.forEach(question => {

                if (
                    question &&
                    question.id
                ) {

                    questionsStore.put(
                        question
                    );
                }
            });
        }
    );
}


// ========================================
// استيراد ملف JSON من الجهاز
// ========================================

async function importDatabaseFile(
    file
) {

    try {

        if (!file) {
            return;
        }

        const text =
            await file.text();

        const backup =
            JSON.parse(text);

        if (
            !Array.isArray(
                backup.files
            ) ||
            !Array.isArray(
                backup.questions
            )
        ) {

            alert(
                "❌ الملف ده مش نسخة قاعدة بيانات صحيحة."
            );

            return;
        }

        const stats =
            await getDatabaseStats();

        let replace = true;

        if (
            stats.files > 0 ||
            stats.questions > 0
        ) {

            replace =
                confirm(`

⚠️ فيه بيانات موجودة بالفعل على الجهاز.

النسخة الجديدة تحتوي على:

📁 ${backup.files.length} ملف

❓ ${backup.questions.length} سؤال

اضغط OK لاستبدال البيانات الحالية بالكامل.

اضغط Cancel لإلغاء العملية.

`);
        }

        if (!replace) {
            return;
        }

        await importDatabaseData(
            backup,
            true,
            false
        );

        alert(`

✅ تم نقل قاعدة البيانات بنجاح!

📁 الملفات:
${backup.files.length}

❓ الأسئلة:
${backup.questions.length}

`);

        await loadFiles();

        await loadCategorySelect(
            "questionCategoryFilter"
        );

        await filterQuestionFiles();

        await loadQuizFilters();

    }

    catch (error) {

        console.error(
            "Import database error:",
            error
        );

        alert(
            "❌ حصل خطأ أثناء استيراد قاعدة البيانات.\n\nتأكد إن الملف هو quiz-database.json الصحيح."
        );
    }
}


// ========================================
// محاولة تحميل النسخة من GitHub تلقائيًا
// ========================================

async function autoLoadOnlineBackup() {

    try {

        const stats =
            await getDatabaseStats();

        // لو الجهاز عنده بيانات بالفعل
        // لا نلمسها
        if (
            stats.files > 0 ||
            stats.questions > 0
        ) {

            return false;
        }

        const response =
            await fetch(
                BACKUP_FILE,
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {

            // الملف مش موجود
            // وده عادي جدًا
            return false;
        }

        const backup =
            await response.json();

        if (
            !Array.isArray(
                backup.files
            ) ||
            !Array.isArray(
                backup.questions
            )
        ) {

            return false;
        }

        if (
            !backup.files.length &&
            !backup.questions.length
        ) {

            return false;
        }

        await importDatabaseData(
            backup,
            true,
            true
        );

        console.log(
            "☁️ تم تحميل قاعدة البيانات تلقائيًا من النسخة الموجودة على الموقع"
        );

        return true;

    }

    catch (error) {

        // لو ملف النسخة مش موجود
        // مش هنطلع للمستخدم أي Error
        console.log(
            "ℹ️ لا توجد نسخة احتياطية أونلاين حاليًا."
        );

        return false;
    }
}


// ========================================
// إنشاء واجهة نقل البيانات
// ========================================

function createDatabaseTools() {

    if (
        document.getElementById(
            "databaseMigrationTools"
        )
    ) {
        return;
    }

    const panel =
        document.createElement("div");

    panel.id =
        "databaseMigrationTools";

    panel.innerHTML = `

        <div
            style="
                margin:20px 0;
                padding:18px;
                border-radius:16px;
                background:#f5f7fa;
                border:1px solid #ddd;
                text-align:center;
            "
        >

            <h3 style="margin-top:0;">
                ☁️ نقل قاعدة الأسئلة
            </h3>

            <p style="line-height:1.7;">
                انقل كل الملفات والأسئلة والتصنيفات
                من اللابتوب للموبايل في ملف واحد.
            </p>

            <button
                id="exportDatabaseButton"
                type="button"
                style="
                    margin:5px;
                    padding:12px 18px;
                    border:0;
                    border-radius:10px;
                    cursor:pointer;
                "
            >
                📤 تصدير قاعدة البيانات
            </button>

            <button
                id="importDatabaseButton"
                type="button"
                style="
                    margin:5px;
                    padding:12px 18px;
                    border:0;
                    border-radius:10px;
                    cursor:pointer;
                "
            >
                📥 استيراد قاعدة البيانات
            </button>

            <input
                type="file"
                id="databaseBackupInput"
                accept=".json,application/json"
                style="display:none;"
            >

            <p
                id="databaseMigrationStatus"
                style="
                    margin-bottom:0;
                    font-size:14px;
                "
            ></p>

        </div>

    `;

    // نحاول نحط الأدوات في صفحة الاستيراد
    const importPage =
        document.getElementById(
            "importPage"
        );

    // لو مش موجودة نحطها في الصفحة الرئيسية
    const homePage =
        document.getElementById(
            "homePage"
        );

    const target =
        importPage ||
        homePage ||
        document.body;

    target.appendChild(panel);

    const exportButton =
        document.getElementById(
            "exportDatabaseButton"
        );

    const importButton =
        document.getElementById(
            "importDatabaseButton"
        );

    const input =
        document.getElementById(
            "databaseBackupInput"
        );

    if (exportButton) {

        exportButton.onclick =
            exportDatabase;
    }

    if (
        importButton &&
        input
    ) {

        importButton.onclick =
            function () {

                input.click();
            };
    }

    if (input) {

        input.addEventListener(
            "change",
            async function () {

                const file =
                    this.files?.[0];

                if (file) {

                    await importDatabaseFile(
                        file
                    );
                }

                this.value = "";
            }
        );
    }
}


// ========================================
// تحديث حالة نقل البيانات
// ========================================

async function updateDatabaseToolsStatus() {

    const status =
        document.getElementById(
            "databaseMigrationStatus"
        );

    if (!status) {
        return;
    }

    try {

        const stats =
            await getDatabaseStats();

        status.innerHTML = `

            📁 الملفات الموجودة:
            <b>${stats.files}</b>

            &nbsp; | &nbsp;

            ❓ الأسئلة:
            <b>${stats.questions}</b>

        `;

    }

    catch (error) {

        console.error(error);
    }
}


// ========================================
// تشغيل الموقع
// ========================================

async function initializeApp() {

    try {

        await openDatabase();

        // إنشاء أزرار نقل قاعدة البيانات
        createDatabaseTools();

        // محاولة تحميل نسخة موجودة على GitHub
        await autoLoadOnlineBackup();

        // تحديث حالة البيانات
        await updateDatabaseToolsStatus();

        await loadCategorySelect(
            "questionCategoryFilter"
        );

        await filterQuestionFiles();

        await loadQuizFilters();

        setupExcelInput();

        console.log(
            "🚀 الموقع جاهز"
        );

    }

    catch (error) {

        console.error(error);

        alert(
            "❌ حصل خطأ في تشغيل قاعدة البيانات"
        );
    }
}


// ========================================
// تشغيل بعد تحميل الصفحة
// ========================================

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeApp
    );

}
else {

    initializeApp();
}
