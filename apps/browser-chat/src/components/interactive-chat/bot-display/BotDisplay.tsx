import * as MikuCore from "@mikugg/core";
import * as MikuExtensions from "@mikugg/extensions";
import React, { useContext, useEffect, useState } from "react";
import "./BotDisplay.css";

import historyIcon from "../../../assets/icons/chat-history.png";
import infoIcon from "../../../assets/icons/information.png";

import { Loader } from "../../loading/Loader";
import botFactory from "../../../libs/botFactory";
import { useBot } from "../../../libs/botLoader";
import { PopUp } from "../../pup-up/pup-up";
import { ChatHistory, HistoryManagementButtons } from "../../chat-history/chat-history";
import { BotDetails } from "../../bot-details/BotDetails";
import "./BotDisplay.css";
import { LeftArrow, RightArrow, Dice, Wand } from "../../../assets/icons/svg";
import { UnmuteIcon } from "@primer/octicons-react";
import { InteractiveResponsesContext } from "../../../libs/useResponses";
import { responsesStore } from "../../../libs/responsesStore";
import { Tooltip } from "@mui/material";
import { BotConfigV1, BotConfigV2 } from "@mikugg/bot-validator";

const VITE_IMAGES_DIRECTORY_ENDPOINT = import.meta.env.VITE_IMAGES_DIRECTORY_ENDPOINT || 'http://localhost:8585/images';

export const BotDisplay = () => {
  const { botConfig } = useBot();
  const [ showHistory, setShowHistory ] = useState<Boolean>(false)
  const [ handleBotDetailsInfo, setHandleBotDetailsInfo ] = useState<boolean>(false);
  const {
    responseIds,
    setResponseIds,
    responseIndex,
    setResponseIndex,
    responsesGenerated,
    setResponsesGenerated,
    loading,
    response,
    prevResponse,
    playAudio,
    currentContext,
    setCurrentContext,
    onUpdate,
  } = useContext(InteractiveResponsesContext);
  const [ contextSuggestion, setContextSuggestion ] = useState<string>('');
  const [ emotionImgIsLoading, setEmotionImgIsLoading ] = useState(false);

  let backgroundImage = Number(botConfig?.configVersion || 1) > 1 ? (
    ((botConfig as BotConfigV2)?.backgrounds || [{source: ''}])[0].source || ''
  ) : (
    (botConfig as BotConfigV1)?.background_pic || ''
  );
  let emotionImage = response?.emotion || prevResponse?.emotion || '';
  if (!emotionImage) {
    const openAIEmotionConfig = botConfig?.outputListeners.find((listener: {service: string}) => listener.service === MikuExtensions.Services.ServicesNames.OpenAIEmotionInterpreter)
    const sbertEmotionConfig = botConfig?.outputListeners.find((listener: {service: string}) => listener.service === MikuExtensions.Services.ServicesNames.SBertEmotionInterpreter)
    if (sbertEmotionConfig) {
      const props = sbertEmotionConfig.props as MikuExtensions.Services.SBertEmotionInterpreterProps;
      const images = props.contexts.find(context => context.id === currentContext)?.emotion_images || [];
      const imageCandidates = images.find(image => image.id === 'neutral')?.hashes;
      emotionImage = imageCandidates ? imageCandidates[0] : '';
    } else {
      // @ts-ignore
      emotionImage = openAIEmotionConfig?.props?.images?.neutral || '';
    }
  }

  useEffect(() => {
    setEmotionImgIsLoading(false);
  }, [emotionImage]);

  useEffect(() => {
    const bot = botFactory.getInstance();
    bot?.subscribeContextChangeSuggestion((contextId) => {
      setContextSuggestion(contextId);
    });
  }, [botConfig])

  const updateContext = () => {
    const bot = botFactory.getInstance();
    const sbertEmotionConfig = botConfig?.outputListeners.find(listener => listener.service === MikuExtensions.Services.ServicesNames.SBertEmotionInterpreter);
    if (bot && sbertEmotionConfig) {
      const props = sbertEmotionConfig.props as MikuExtensions.Services.SBertEmotionInterpreterProps
      const context = props.contexts.find(context => context.id === contextSuggestion);
      if (context) {
        bot.changeContext(contextSuggestion);
        setCurrentContext(contextSuggestion);
        // @ts-ignore
        bot.sendPrompt(`*I notice that ${context.context_change_trigger}*`, MikuCore.Commands.CommandType.DIALOG);
      }
    }
  }

  const handleHistoryButtonClick = () => setShowHistory(true);
  const displayBotDetails = () => setHandleBotDetailsInfo(true)

  const onRightClick = (event: React.UIEvent) => {
    if (responseIndex > 0 && responseIds.length > 0) {
      setResponseIndex(responseIndex - 1);
    }
  }

  const onLeftClick = (event: React.UIEvent) => {
    if (responseIndex < responseIds.length - 1) {
      setResponseIndex(responseIndex + 1);
    }
  }

  const onRegenerateClick = (event: React.UIEvent) => {
    const bot = botFactory.getInstance();
    const shortTermMemory = bot?.getMemory();
    const memoryLines = shortTermMemory?.getMemory();
    if (shortTermMemory && memoryLines && memoryLines.length >= 2) {
      shortTermMemory.clearMemories();
      memoryLines.forEach((line, index) => {
        if (index < memoryLines.length - 2) {
          shortTermMemory.pushMemory(line);
        }
      })

      const lastMemoryLine = memoryLines[memoryLines.length - 2];

      event.preventDefault();
      setResponseIds(_responseIds => {
        const responseIds = [..._responseIds];
        responseIds.shift();
        return responseIds;
      });
      const result = botFactory.getInstance()?.sendPrompt(lastMemoryLine.text, lastMemoryLine.type);
      if (result?.commandId) {
        setResponsesGenerated(_responsesGenerated => {
          const responsesGenerated = [result.commandId, ..._responsesGenerated];
          return responsesGenerated;
        });
      }
    }
  }

  const onOptionClick = (responseId: string, event: React.UIEvent) => {
    setResponseIds(_ids => {
      const ids = [..._ids]
      ids.shift();
      return [responseId, ...ids];
    });
    const shortTermMemory = botFactory.getInstance()?.getMemory();
    const memoryLines = shortTermMemory?.getMemory();
    if (shortTermMemory && memoryLines && memoryLines.length >= 2) {
      shortTermMemory.clearMemories();
      memoryLines.forEach((line, index) => {
        if (index < memoryLines.length - 1) {
          shortTermMemory.pushMemory(line);
        }
      })
      const text = responsesStore.get(responseId)?.text;
      if (text) {
        shortTermMemory.pushMemory({
          text,
          type: MikuCore.Commands.CommandType.DIALOG,
          subject: shortTermMemory.getBotSubject()
        });
      }
    }
  }

  return (
    // MAIN CONTAINER
    <>
      <div className="relative flex flex-col w-full h-full items-center">
        {/* MAIN IMAGE */}
        <div className="absolute flex flex-col justify-center items-center w-full h-full overflow-hidden bot-display-images-container">
          <div className="flex items-center justify-between pt-3 px-3 absolute z-10 top-0 w-full">
            <div className="flex gap-3">
              <button className="rounded-full" onClick={displayBotDetails}><img src={infoIcon}/></button>
              {/* <button className="rounded-full"><img src={backgroundIcon}/></button> */}
            </div>
            <div className="flex gap-3">
              <button className="rounded-full" onClick={handleHistoryButtonClick}><img src={historyIcon}/></button>
              {/* <button className="rounded-full"><img src={settingsIcon}/></button> */}
            </div>
          </div>
          <img className="h-full w-full z-0 rounded-xl conversation-background-image object-cover"
            src={`${VITE_IMAGES_DIRECTORY_ENDPOINT}/${backgroundImage}`}
            alt="background"
            onError={({ currentTarget }) => {
              currentTarget.onerror = null;
              currentTarget.src = "/default_background.png";
            }}
          />
          <img
            className={`absolute bottom-0 h-[80%] z-10 conversation-bot-image object-cover ${emotionImgIsLoading ? 'fade-in up-and-down' : ''}`}
            src={`${VITE_IMAGES_DIRECTORY_ENDPOINT}/${emotionImage}`}
            alt="character"
            onError={({ currentTarget }) => {
              currentTarget.onerror = null;
              currentTarget.src = "/default_character.png";
            }}
            onLoadStart={() => setEmotionImgIsLoading(false)}
            onLoad={() => setEmotionImgIsLoading(true)}
          />
        </div>
        {/* RESPONSE CONTAINER */}
        <div
          className={
            (!responseIds.length)
              ? "hidden"
              : "absolute bottom-10 z-10 flex justify-center items-center w-full h-1/4"
          }
        >
          <div className="response-container h-3/4 w-10/12 relative">
            <div className="flex justify-left px-8 py-4 items-start scrollbar w-full h-full bg-gradient-to-b from-slate-900/[.7] to-gray-500/50 rounded-md overflow-auto border-[4px] drop-shadow-2xl shadow-black">
              {!response || loading ? (
                <Loader />
              ) : (
                <p className="text-md font-bold text-white ">{response?.text || ''}</p>
              )}
            </div>
            {
              (!loading && responseIds.length > 1) ? (
                <div className="response-swiping absolute top-[-2em] left-2 inline-flex justify-between gap-4 bg-slate-900/80 p-2 text-white rounded-t-md">
                  <button
                    className="text-gray-300 disabled:text-gray-500 hover:text-white transition-all"
                    onClick={onLeftClick}
                    disabled={responseIndex >= responseIds.length - 1}
                  >
                    <LeftArrow />
                  </button>
                  <button
                    className="text-gray-300 disabled:text-gray-500 hover:text-white transition-all"
                    onClick={onRightClick}
                    disabled={responseIndex <= 0}
                  >
                    <RightArrow />
                  </button>
                </div>
              ) : null
            }
            {
              !loading && responseIndex === 0 ? (
                <button
                  className="reload-button absolute top-[-2.5em] right-2 inline-flex items-center gap-2 bg-slate-900/80 p-2 drop-shadow-2xl shadow-black text-white rounded-t-md"
                  onClick={onRegenerateClick}
                >
                  <Dice />
                  Regenerate
                </button>
              ) : null
            }
            {
              (!loading && response?.audio) ? (
                <button
                  className="audio-button absolute bottom-3 left-3 inline-flex items-center gap-2 text-gray-400 rounded-md hover:text-white"
                  onClick={() => playAudio(response?.audio || '')}
                >
                  <UnmuteIcon size={24} />
                </button>
              ) : null
            }
            {
              (!loading && contextSuggestion) ? (
                <Tooltip title="Randomize character outfit" placement="left">
                  <button
                    className="wand-button absolute bottom-4 right-4 inline-flex items-center gap-2 text-white rounded-md hover:text-white"
                    onClick={updateContext}
                  >
                    <Wand />
                  </button>
                </Tooltip>
              ) : null
            }
            {
              (!loading && responsesGenerated.length > 1 && responseIndex === 0) ? (
                <div className="reload-button absolute bottom-[-3.4em] right-[1em] flex items-center gap-2 bg-slate-900/80 p-2 drop-shadow-2xl shadow-black text-white rounded-b-md text-xs max-w-[90%] overflow-auto">
                  {
                    responsesGenerated.map((responseId, index) => (
                      <button
                        className={`inline-flex transition-all items-center hover:text-white ${responseIds[0] === responseId ? 'text-white' : 'text-gray-400'}`}
                        key={responseId}
                        onClick={(event) => onOptionClick(responseId, event)}>
                          <Dice />
                      </button>
                    ))
                  }
                </div>
              ) : null
            }
          </div>
        </div>
      </div>
      <PopUp 
        className ="gap-4 justify-between" 
        darkTheme closePopUpFunction={()=>setShowHistory(false)} 
        isShowingPupUp={showHistory}
        >
        <p className="ml-4 text-start text-2xl text-white">Conversation History</p>
        <ChatHistory />
        <div className="w-full flex justify-center gap-7 pb-3 flex-wrap red-500 text-red-500">
          <HistoryManagementButtons onLoad={() => onUpdate()} />
        </div>
      </PopUp> 
      <PopUp 
        closePopUpFunction={() => setHandleBotDetailsInfo(false)} 
        isShowingPupUp={handleBotDetailsInfo}
        className="w-6/12"
        darkTheme
        >
          <BotDetails />
      </PopUp>
    </>
  );
};
