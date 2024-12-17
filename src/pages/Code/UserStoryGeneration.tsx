import React, { useEffect } from "react";
import WelcomeChatComp from "../../components/WelcomeChatComp";

import Loader from "../../components/Loader";

import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import { useAlert } from "../../hook/useAlert";
import AceEditor from "react-ace";
import { CALL_GPT, SEARCH, EXTRACT_IMAGE_TO_TEXT } from "../../config";
// Import a theme and language
import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/worker-javascript";
import "ace-builds/src-noconflict/theme-monokai";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import RateReviewIcon from "@mui/icons-material/RateReview";
import CreateUserStory from "./components/CreateUserStory";
import CreateTestCases from "./components/CreateTestCases";
import CreateTestData from "./components/CreateTestData";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import AutoCompleteInput from "../../components/SelectCollection";

import ContextData from "./components/ContextData";
import BoldText from "./components/BoldText";
import ViewStory from "../../layout/ViewStory";
import { useFetch } from "../../hook/useFetch";

const Chat: React.FC = () => {
  const fetchData = useFetch();

  const [loading, setLoading] = React.useState(false);

  const [imageUploadLoading, setImageUploadLoading] = React.useState(false);
  const [userStoryLoading, setUserStoryLoading] = React.useState(false);
  const [testCaseLoading, setTestCaseLoading] = React.useState(false);
  const [testDataLoading, setTestDataLoading] = React.useState(false);
  const [codeLoading, setCodeLoading] = React.useState(false);

  const [userQuery, setUserQuery] = React.useState<string | null>(null);
  const [userStory, setUserStory] = React.useState<string | null>(null);
  const [testCase, setTestCase] = React.useState<string | null>(null);
  const [testData, setTestData] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [uploadFile, setUploadFile] = React.useState<boolean>(false);

  const [contextDataForStory, setContextDataForStory] =
    React.useState<any>(null);
  const [code, setCode] = React.useState<string | null>(null);
  const { triggerAlert } = useAlert();

  const [codeLang, setCodeLang] = React.useState("");
  const urlParams = new URLSearchParams(window.location.hash.split("?")[1]);
  const taskId = urlParams.get("task");
  const [value, setValue] = React.useState<any>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  const getInstructions = (instructionForUserStories: string) => {
    const config = JSON.parse(localStorage.getItem("config") || "{}");
    const instructions = config[instructionForUserStories] || [];
    const concatenatedInstructions = instructions.map(
      (instruction: any, index: number) =>
        `\n ${index + 1}: ${instruction.value}`
    );
    return concatenatedInstructions.join("");
  };

  const getContext = async (query: string) => {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({
      query: query,
      collection_name: localStorage.getItem("selected_collection"),
      no_of_results: 3,
      fine_chunking: false,
      if_gpt_summarize: false,
    });

    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow" as RequestRedirect,
    };

    return fetchData(SEARCH, requestOptions)
      .then((response) => response.json())
      .then((result) => {
        console.log(result);
        return result;
      })
      .catch((error) => error);
  };

  const saveDataToLocalStorage = () => {
    const data = [
      {
        id: new Date().getTime(),
        sprint: "backlog",
        userQuery,
        userStory,
        testCase,
        testData,
        code,
        contextData: contextDataForStory,
      },
    ];

    const backlogData = localStorage.getItem("backlogData");

    if (backlogData) {
      if (taskId) {
        const parsedData = backlogData ? JSON.parse(backlogData) : [];
        const taskIndex = parsedData.findIndex(
          (item: any) => item.id.toString() == taskId
        );
        if (taskIndex !== -1) {
          parsedData[taskIndex] = {
            ...parsedData[taskIndex],
            userStory,
            testCase,
            userQuery,
            testData,
            code,
          };
          localStorage.setItem("backlogData", JSON.stringify(parsedData));
        }
      } else {
        const parsedData = JSON.parse(backlogData);
        parsedData.push(...data);
        localStorage.setItem("backlogData", JSON.stringify(parsedData));
      }
    } else {
      localStorage.setItem("backlogData", JSON.stringify(data));
    }
    triggerAlert("Ticket created Successfully & pushed to backlog!", "success");
    window.location.href = "#/backlog";
  };

  const handleChange = (event: SelectChangeEvent) => {
    setCodeLang(event.target.value as string);
  };

  const callGpt = async (query: string): Promise<string | null> => {
    setLoading(true);
    const response = await fetchData(CALL_GPT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: query,
      }),
    })
      .then((response) => response.text())
      .then((data) => {
        setLoading(false);
        return data;
      })
      .catch((error) => {
        console.error("Error:", error);
        setLoading(false);
        return error;
      });
    return response;
  };

  const handleUpload = (e: any) => {
    e.preventDefault();
    if (!file) {
      console.error("No file selected");
      return;
    }

    setLoading(true);
    const formdata = new FormData();
    formdata.append("file", file);

    const requestOptions = {
      method: "POST",
      body: formdata,
      redirect: "follow" as RequestRedirect,
    };

    fetchData(EXTRACT_IMAGE_TO_TEXT, requestOptions)
      .then((response) => response.json())
      .then((result) => {
        console.log(result);
        generateUserStory(result?.details);
      })
      .catch((error) => {
        console.error(error);
        setLoading(false);
      });
  };

  const generateUserStory = async (query: string) => {
    if (query.length === 0) return;
    setUserQuery(query);
    setUserStoryLoading(true);
    const contextData = await getContext(query);
    // console.log(
    //   "=========fine_results=========>",
    //   contextData?.results?.fine_results
    // );
    // console.log(
    //   "=========gpt_results=========>",
    //   contextData?.results?.gpt_results
    // );
    // console.log(
    //   "=========default=========>",
    //   contextData?.results?.results?.documents
    // );

    localStorage.setItem("userQuery", query as string);
    localStorage.setItem("contextData", JSON.stringify(contextData));
    setContextDataForStory(contextData);
    const effectiveContext = JSON.stringify(contextData?.results?.documents);
    // const effectiveContext = contextData?.results?.gpt_results;
    // const effectiveContext = contextData?.results?.fine_results;
    const instructionForUserStories = getInstructions(
      "instructionForUserStories"
    );
    const userStorydata = await callGpt(`
        Write an elaborate agile user story in Gherkin format for ${query}
        Include Acceptance Criteria, Assumptions, and Dependencies
        ${instructionForUserStories}
       
        
        Context of the story should be: ${effectiveContext}
        `);
    setUserStory(userStorydata);
    userStorydata && localStorage.setItem("userStory", userStorydata);
    setUserStoryLoading(false);
  };

  const onsubmitHandler = async (e: any) => {
    e.preventDefault();

    const query = e.target.query.value;
    generateUserStory(query);
  };

  const generateTestCases = async () => {
    if (!userStory) return;
    setTestCaseLoading(true);
    const instructionForTestCases = getInstructions("instructionForTestCases");

    const testcaseData = await callGpt(
      `
      UserStory: 
      ${userStory}

      generate test cases for the above user story

      Follow the instructions: 
      ${instructionForTestCases}
      `
    );
    setTestCase(testcaseData);
    testcaseData && localStorage.setItem("testcase", testcaseData);
    setTestCaseLoading(false);
  };

  const generateTestData = async () => {
    setTestDataLoading(true);
    if (!testCase) return;
    const instructionForTestData = getInstructions("instructionForTestData");

    const testcaseData = await callGpt(
      `
      TestCase: 
      ${testCase}

       Generate a HTML code of sample sets of test data for the above TestCase 
      

      Follow the instructions: 
      ${instructionForTestData}
      `
    );
    setTestData(testcaseData);
    testcaseData && localStorage.setItem("testdata", testcaseData);
    setTestDataLoading(false);
  };

  const generateCode = async () => {
    if (!testData) return;
    setCodeLoading(true);
    const instructionForCode = getInstructions("instructionForCode");

    const testCode = await callGpt(`
      Generate sample codes example in ${codeLang} for the  user story of :  ${userStory} \n that supports the bellow test cases\n ${testCase}

      Follow the instructions: 
      ${instructionForCode}
      `);
    setCode(testCode);
    testCode && localStorage.setItem("code", testCode);
    setCodeLoading(false);
  };

  React.useEffect(() => {
    const savedUserStory = localStorage.getItem("userStory");
    const savedTestcase = localStorage.getItem("testcase");
    const savedTestData = localStorage.getItem("testdata");
    const userQueryData = localStorage.getItem("userQuery");
    const testCode = localStorage.getItem("code");
    const contextDataStore = localStorage.getItem("contextData");
    if (savedUserStory) {
      setUserStory(savedUserStory);
    }
    if (savedTestcase) {
      setTestCase(savedTestcase);
    }
    if (savedTestData) {
      setTestData(savedTestData);
    }
    if (testCode) {
      setCode(testCode);
    }
    if (contextDataStore) {
      setContextDataForStory(JSON.parse(contextDataStore));
    }
    if (userQueryData) {
      setUserQuery(userQueryData);
    }
  }, []);

  React.useEffect(() => {
    if (taskId) {
      const backlogData = localStorage.getItem("backlogData");
      if (backlogData) {
        const parsedData = JSON.parse(backlogData);
        const task = parsedData.find(
          (item: any) => item.id.toString() == taskId
        );

        if (task) {
          localStorage.setItem("userStory", task.userStory);
          localStorage.setItem("testcase", task.testCase);
          localStorage.setItem("testdata", task.testData);
          localStorage.setItem("userQuery", task.userQuery);
          localStorage.setItem("code", task.code);
          if (task?.contextData)
            localStorage.setItem(
              "contextData",
              JSON.stringify(task?.contextData)
            );

          setUserStory(task.userStory);
          setTestCase(task.testCase);
          setTestData(task.testData);
          setCode(task.code);
          setUserQuery(task.userQuery);
          setContextDataForStory(task.contextData);
        }
      }
    }
  }, []);

  const startNewProcess = () => {
    localStorage.removeItem("userStory");
    localStorage.removeItem("testcase");
    localStorage.removeItem("testdata");
    localStorage.removeItem("code");
    localStorage.removeItem("contextData");
    localStorage.removeItem("userQuery");
    setUserStory(null);
    setTestCase(null);
    setTestData(null);
    setCode(null);
    setContextDataForStory(null);
    setUserQuery(null);
    window.location.href = "#/story";
  };

  return (
    <>
      <div className="chat-hldr">
        <div className="chat-scrollhldr">
          <div
            style={{
              marginTop: "1rem",
              display: "flex",
              justifyContent: "right",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                width: "100%",
              }}
            >
              <button
                className="newConversationButton"
                style={{ width: "100px", height: 20 }}
                onClick={() => startNewProcess()}
              >
                Start new
                <img
                  src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACIAAAAiCAYAAAA6RwvCAAAAAXNSR0IArs4c6QAAAqBJREFUWAm1WLuRAjEMpQRKuAYogIyIAiiAuRgSIghhhgIoAGaOkOwIyKEDLoQcYlk0sHdvx1qMd621ObgZj9a29PQsyR+u0Uj4I6ImEY2Y+csYc2RmYubMNsKYMeabiD6J6CMBOk6ViDrGmL3jVJyr0pLqxHlRtLCqZwj4hC2h5yJkU+CGXl2977yiT8BU1l2e+gOZVgD9l4jYT8seK0beTCKOjE2HKKvyfD5n4/H4oV2vV9XGjXIwTShMbzuqoIfDIWu1Wlm3283a7Xb+jTHXWc03aqZcwKjsGsMHJ0IE0v1OwbjdbvuH6sA5kQIAXde5+52KA98FGSLaagCn0ynz2263K9IhRDabTUkPdhp2ERVbG0FlAKEWQg0khEhIp44Mro4G7gWNsRDBDsGK/YZ57BZ/HH3YgFwEkRGI1KYFYADWCFfNwSaGCC7RBjPjFg06kYhMJpPKVVdFQsZgE0nkCCLqfSJEAPhsizjoCESC0ZA52SHL5TIvTClQTUIXxGNTGkVEQCNWVixKIglbWZAma1MD4/l8nh/jAoQIDYfDkoPBYJBhTvRw9MNW+orMU6MWK4z7/X7eBGixWOR3jPRF+qmAXa/XiyFyxPZdC1BI+iuLJeJHMoTPzFsQwWM4yBp1gZXCOfKOBge4daUvEnqr1aoYhw3GMK/5wKEKIk1Nqe74hqO6BgzNR/EcwMUTUkREUIBySD0jL5eLRmTr3r7Jz4AQ8dTxh2cAGGlRSQVP0L9HQ8JinwPqcZ/gQEuFzFU/FUGobge9mIj+G4eZZy92KBFw5Uwyoco3k4kjIQxtml5ZM8DS0yHOfWkLWH3BxaTRGHMoDi3fSUrf/txIJmQJ3H8upDjVdLEq+9jeGmN+vNcd/lGDsTXSmr/MNTBv7hffBPEsHKEseQAAAABJRU5ErkJggg=="
                  alt="Clear Chat"
                />
              </button>
              <p style={{ fontSize: 10, marginTop: 0 }}>
                * Old data will be cleared on starting new
              </p>

              {taskId && (
                <div
                  style={{
                    width: "100%",
                  }}
                >
                  <span>
                    Task id: <b>{taskId}</b>
                  </span>
                </div>
              )}
            </div>

            {!taskId && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  width: "100%",
                }}
              >
                <AutoCompleteInput />

                <p style={{ fontSize: 10 }}>
                  * generated data will be base on selected collection only
                </p>
              </div>
            )}
          </div>

          <WelcomeChatComp />
          <div className="chat-msg">
            <ViewStory
              taskId={taskId}
              welcomeCompontent={() => userStory && <WelcomeChatComp />}
              userQuery={() =>
                userQuery && (
                  <div>
                    <h2
                      style={{
                        marginBottom: 25,
                      }}
                    >
                      User Query
                    </h2>
                    <div className="chat-msg-list msg-hldr-cb gap10px pre-div ">
                      <BoldText text={userQuery} />
                    </div>
                  </div>
                )
              }
              userStory={() =>
                userStory && (
                  <>
                    {!userStoryLoading ? (
                      <CreateUserStory
                        userStory={userStory}
                        setUserStory={setUserStory}
                        testCase={testCase}
                        generateTestCases={generateTestCases}
                      />
                    ) : (
                      <Loader />
                    )}
                  </>
                )
              }
              testCase={() =>
                testCase && (
                  <>
                    {!testCaseLoading ? (
                      <CreateTestCases
                        testCase={testCase}
                        setTestCase={setTestCase}
                        generateTestCases={generateTestCases}
                        generateTestData={generateTestData}
                      />
                    ) : (
                      <Loader />
                    )}
                  </>
                )
              }
              testData={() =>
                testData && (
                  <>
                    {!testDataLoading ? (
                      <CreateTestData
                        testData={testData}
                        setTestData={setTestData}
                        generateTestData={generateTestData}
                      />
                    ) : (
                      <Loader />
                    )}
                  </>
                )
              }
              codeData={() => (
                <>
                  {testData && (
                    <FormControl fullWidth>
                      <div style={{ display: "flex" }}>
                        <div style={{ marginRight: 10, padding: 7 }}>
                          <InputLabel id="demo-simple-select-label">
                            Select language
                          </InputLabel>
                          <Select
                            labelId="demo-simple-select-label"
                            id="demo-simple-select"
                            value={codeLang}
                            label="Age"
                            onChange={handleChange}
                            size="small"
                            style={{ width: "300px" }}
                          >
                            <MenuItem value={"React JS"}>React JS</MenuItem>
                            <MenuItem value={"Python"}>Python</MenuItem>
                            <MenuItem value={"HTML"}>HTML</MenuItem>
                            <MenuItem value={"Kotlin"}>Kotlin</MenuItem>
                            <MenuItem value={"Apex"}>
                              Apex (Salesforce)
                            </MenuItem>
                          </Select>
                        </div>
                        <button
                          className="newConversationButton"
                          style={{ width: "130px" }}
                          onClick={() => generateCode()}
                        >
                          Generate code
                          <img
                            src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACIAAAAiCAYAAAA6RwvCAAAAAXNSR0IArs4c6QAAAqBJREFUWAm1WLuRAjEMpQRKuAYogIyIAiiAuRgSIghhhgIoAGaOkOwIyKEDLoQcYlk0sHdvx1qMd621ObgZj9a29PQsyR+u0Uj4I6ImEY2Y+csYc2RmYubMNsKYMeabiD6J6CMBOk6ViDrGmL3jVJyr0pLqxHlRtLCqZwj4hC2h5yJkU+CGXl2977yiT8BU1l2e+gOZVgD9l4jYT8seK0beTCKOjE2HKKvyfD5n4/H4oV2vV9XGjXIwTShMbzuqoIfDIWu1Wlm3283a7Xb+jTHXWc03aqZcwKjsGsMHJ0IE0v1OwbjdbvuH6sA5kQIAXde5+52KA98FGSLaagCn0ynz2263K9IhRDabTUkPdhp2ERVbG0FlAKEWQg0khEhIp44Mro4G7gWNsRDBDsGK/YZ57BZ/HH3YgFwEkRGI1KYFYADWCFfNwSaGCC7RBjPjFg06kYhMJpPKVVdFQsZgE0nkCCLqfSJEAPhsizjoCESC0ZA52SHL5TIvTClQTUIXxGNTGkVEQCNWVixKIglbWZAma1MD4/l8nh/jAoQIDYfDkoPBYJBhTvRw9MNW+orMU6MWK4z7/X7eBGixWOR3jPRF+qmAXa/XiyFyxPZdC1BI+iuLJeJHMoTPzFsQwWM4yBp1gZXCOfKOBge4daUvEnqr1aoYhw3GMK/5wKEKIk1Nqe74hqO6BgzNR/EcwMUTUkREUIBySD0jL5eLRmTr3r7Jz4AQ8dTxh2cAGGlRSQVP0L9HQ8JinwPqcZ/gQEuFzFU/FUGobge9mIj+G4eZZy92KBFw5Uwyoco3k4kjIQxtml5ZM8DS0yHOfWkLWH3BxaTRGHMoDi3fSUrf/txIJmQJ3H8upDjVdLEq+9jeGmN+vNcd/lGDsTXSmr/MNTBv7hffBPEsHKEseQAAAABJRU5ErkJggg=="
                            alt="Clear Chat"
                          />
                        </button>
                      </div>
                    </FormControl>
                  )}
                  {code && !loading && (
                    <>
                      <h2>Generated Code</h2>

                      {!codeLoading ? (
                        <AceEditor
                          mode="javascript"
                          theme="monokai"
                          value={code}
                          onChange={(newValue) => {
                            setCode(newValue);
                            localStorage.setItem("code", newValue);
                          }}
                          setOptions={{
                            useWorker: false,
                          }}
                          editorProps={{ $blockScrolling: true }}
                          //   height="400px"
                          width="100%"
                          style={{ padding: 10, borderRadius: 15 }}
                        />
                      ) : (
                        <Loader />
                      )}

                      <br />

                      <div
                        style={{ display: "flex", justifyContent: "flex-end" }}
                      >
                        <button
                          className="newConversationButton"
                          style={{ width: "130px" }}
                          onClick={() => saveDataToLocalStorage()}
                        >
                          {taskId ? "Update" : "Save"}
                          <img
                            src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACIAAAAiCAYAAAA6RwvCAAAAAXNSR0IArs4c6QAAAqBJREFUWAm1WLuRAjEMpQRKuAYogIyIAiiAuRgSIghhhgIoAGaOkOwIyKEDLoQcYlk0sHdvx1qMd621ObgZj9a29PQsyR+u0Uj4I6ImEY2Y+csYc2RmYubMNsKYMeabiD6J6CMBOk6ViDrGmL3jVJyr0pLqxHlRtLCqZwj4hC2h5yJkU+CGXl2977yiT8BU1l2e+gOZVgD9l4jYT8seK0beTCKOjE2HKKvyfD5n4/H4oV2vV9XGjXIwTShMbzuqoIfDIWu1Wlm3283a7Xb+jTHXWc03aqZcwKjsGsMHJ0IE0v1OwbjdbvuH6sA5kQIAXde5+52KA98FGSLaagCn0ynz2263K9IhRDabTUkPdhp2ERVbG0FlAKEWQg0khEhIp44Mro4G7gWNsRDBDsGK/YZ57BZ/HH3YgFwEkRGI1KYFYADWCFfNwSaGCC7RBjPjFg06kYhMJpPKVVdFQsZgE0nkCCLqfSJEAPhsizjoCESC0ZA52SHL5TIvTClQTUIXxGNTGkVEQCNWVixKIglbWZAma1MD4/l8nh/jAoQIDYfDkoPBYJBhTvRw9MNW+orMU6MWK4z7/X7eBGixWOR3jPRF+qmAXa/XiyFyxPZdC1BI+iuLJeJHMoTPzFsQwWM4yBp1gZXCOfKOBge4daUvEnqr1aoYhw3GMK/5wKEKIk1Nqe74hqO6BgzNR/EcwMUTUkREUIBySD0jL5eLRmTr3r7Jz4AQ8dTxh2cAGGlRSQVP0L9HQ8JinwPqcZ/gQEuFzFU/FUGobge9mIj+G4eZZy92KBFw5Uwyoco3k4kjIQxtml5ZM8DS0yHOfWkLWH3BxaTRGHMoDi3fSUrf/txIJmQJ3H8upDjVdLEq+9jeGmN+vNcd/lGDsTXSmr/MNTBv7hffBPEsHKEseQAAAABJRU5ErkJggg=="
                            alt="Clear Chat"
                          />
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
              referance={() =>
                contextDataForStory && (
                  <ContextData data={contextDataForStory} />
                )
              }
            />

            {loading && <Loader />}
          </div>
        </div>
        <br />
        <br />

        {!userStory && (
          <>
            {!uploadFile ? (
              <form
                onSubmit={(e) => onsubmitHandler(e)}
                style={{ gridColumn: "span 4", marginBottom: "20px" }}
              >
                <div className="Input-Container">
                  {!file && (
                    <input
                      className="Input-Field"
                      type="text"
                      placeholder="Enter your query here"
                      id="query"
                      name="query"
                    />
                  )}

                  <button className="Send-Button" type="submit">
                    <img
                      src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAAAddJREFUaAXtmOFtwjAQRhmhI+RnFO47ZYSO0BEYgREYgQ3aTdoN2g3oBozQ9ipOOqwkOPjsGClIyHYI8Xtnn+Nks1k/awTWCFxFgIieAZwB/AB4bdu2uTqh9gaA0wVeBPT7OCIm+gpvy/pFiOhgIm/hbb1ekUsOWNipep0iAN4jRsGK1SWy3W73MwVUpg6Rvu+fbiSzAo+Vy4vcMY2GZJYTmZnMQ/D22DIiidPICmi9rEjkPUHh5pRlRJyn0ZBgfhGnZB6Ct8fyiSTcEyxgbN1f5HJPiAXwOs9XRHKBmfdEdATwwcz6vOAFPHYdXxH7LCMjU1Asn4iVknpOMcnHsL9ibSexczHgsKOmaf6nnERRcomIZMs+K5eY+RRe173tATq0lRd4yTk34FygIbyAA9glgYt5ytCHUDFtF3CxlvdCMR16neMGrkPWdd3OC27qOu7gKkBEn1Mdp/6WDTz39MkKrtEH8JYa4fD/RcCNwNB70rGN1+TxouAiAOAljN497eLgJvpJ00e23Mx8kD2QXrNYmbL2LwquEbpn7a8CXAXmrP1VgYtA7PSpDlyjf2vtrxZcBcamT/XgKhC+yHoYcBXouq7/u4l9MfP3Yuu4wqzlGoE1Ajcj8AvY+lHSUC3vMgAAAABJRU5ErkJggg=="
                      alt="Send"
                      className="Send-Icon"
                    />
                  </button>
                  <button
                    className="Send-Button"
                    type="button"
                    onClick={() => {
                      setUploadFile(!uploadFile);
                      document.getElementById("query_img")?.click();
                    }}
                  >
                    <AttachFileIcon />
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={(e) => handleUpload(e)}
                style={{ gridColumn: "span 4", marginBottom: "20px" }}
              >
                <div className="Input-Container">
                  <input
                    className="Input-Field"
                    type="file"
                    placeholder="Enter your query here"
                    id="query_img"
                    name="query_img"
                    onChange={handleFileChange}
                  />

                  <button className="Send-Button" type="submit">
                    <img
                      src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAAAddJREFUaAXtmOFtwjAQRhmhI+RnFO47ZYSO0BEYgREYgQ3aTdoN2g3oBozQ9ipOOqwkOPjsGClIyHYI8Xtnn+Nks1k/awTWCFxFgIieAZwB/AB4bdu2uTqh9gaA0wVeBPT7OCIm+gpvy/pFiOhgIm/hbb1ekUsOWNipep0iAN4jRsGK1SWy3W73MwVUpg6Rvu+fbiSzAo+Vy4vcMY2GZJYTmZnMQ/D22DIiidPICmi9rEjkPUHh5pRlRJyn0ZBgfhGnZB6Ct8fyiSTcEyxgbN1f5HJPiAXwOs9XRHKBmfdEdATwwcz6vOAFPHYdXxH7LCMjU1Asn4iVknpOMcnHsL9ibSexczHgsKOmaf6nnERRcomIZMs+K5eY+RRe173tATq0lRd4yTk34FygIbyAA9glgYt5ytCHUDFtF3CxlvdCMR16neMGrkPWdd3OC27qOu7gKkBEn1Mdp/6WDTz39MkKrtEH8JYa4fD/RcCNwNB70rGN1+TxouAiAOAljN497eLgJvpJ00e23Mx8kD2QXrNYmbL2LwquEbpn7a8CXAXmrP1VgYtA7PSpDlyjf2vtrxZcBcamT/XgKhC+yHoYcBXouq7/u4l9MfP3Yuu4wqzlGoE1Ajcj8AvY+lHSUC3vMgAAAABJRU5ErkJggg=="
                      alt="Send"
                      className="Send-Icon"
                    />
                  </button>
                  <button
                    className="Send-Button"
                    type="button"
                    onClick={() => setUploadFile(!uploadFile)}
                  >
                    <TextFieldsIcon />
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default Chat;
