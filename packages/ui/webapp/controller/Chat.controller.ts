import BaseController from "./BaseController";
import UI5Event from "sap/ui/base/Event";
import Helper from "../util/Helper";
import Context from "sap/ui/model/odata/v4/Context";
import { IMessages, IChats, Sender } from "../types/ChatService";
import FeedInput from "sap/m/FeedInput";
import ODataListBinding from "sap/ui/model/odata/v4/ODataListBinding";
import UserModel from "../model/UserModel";
import List from "sap/m/List";
import ChatService from "../service/ChatService";
import Control from "sap/ui/core/Control";
import Toast from "sap/ui/webc/main/Toast";
import NewMessageHandler from "../service/NewMessageHandler";

/**
 * @namespace com.p36.capui5gptchat.controller
 */
export default class Chat extends BaseController {
  public onInit(): void {
    this.getRouter().getRoute("chat").attachPatternMatched(this.onRouteMatched, this);
  }

  public onAfterRendering(): void {
    this.addKeyboardEventsToInput();
    (<List>this.getView().byId("messageList")).addEventDelegate({
      onAfterRendering: () => {
        this.scrollToBottom(100, "auto");
      },
    });
  }

  private onRouteMatched(event: UI5Event): void {
    const { chat } = event.getParameter("arguments");
    this.getView().bindElement({
      path: `/Chats(${chat})`,
    });
  }

  public onStreamingEnabledChange(event: UI5Event): void {
    ChatService.getInstance().submitChanges();
    const toast = <Toast>this.getView().byId("steamingEnabledToast");
    toast.setText(`Streaming ${event.getParameter("state") ? "enabled" : "disabled"} for chat.`);
    toast.show();
  }

  public onDeleteChat(event: UI5Event): void {
    Helper.withConfirmation("Delete Chat", "Are you sure you want to delete this chat?", async () => {
      await ChatService.getInstance().deleteEntity(<Context>this.getView().getBindingContext());
      this.getRouter().navTo("home");
    });
  }

  public async onPostMessage(event: UI5Event): Promise<void> {
    const message = event.getParameter("value");
    const chat = <IChats>this.getView().getBindingContext().getObject();
    const binding = <ODataListBinding>this.getView().byId("messageList").getBinding("items");

    const messageHandler = new NewMessageHandler({
      chat: chat,
      binding: binding,
      message: message,
      sender: (<UserModel>this.getModel("user")).getUser().displayName,
      streamingCallback: (chunk: string, replyContext: Context) => {
        if (!chunk) return;
        // Just append the chunk to the text property of the reply context.
        replyContext.setProperty("text", `${replyContext.getProperty("text")}${chunk}`);
        this.scrollToBottom(0);
      },
    });
    await messageHandler.createMessageAndCompletion();
  }

  private scrollToBottom(timeout: number, behavior: ScrollBehavior = "smooth"): void {
    setTimeout(() => {
      (<Control>this.getView().byId("listEndMarker")).getDomRef().scrollIntoView({ behavior: behavior });
    }, timeout);
  }

  private addKeyboardEventsToInput(): void {
    const input = <FeedInput>this.getView().byId("newMessageInput");
    input.attachBrowserEvent("keydown", (event: KeyboardEvent) => {
      if (event.key == "Enter" && (event.ctrlKey || event.metaKey) && input.getValue().trim() != "") {
        input.fireEvent("post", { value: input.getValue() });
        input.setValue(null);
        event.preventDefault();
      }
    });
  }
}
