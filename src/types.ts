export interface NewRule {
  id: number,
  priority: number,
  action: {
    type: chrome.declarativeNetRequest.RuleActionType,
    redirect?: {
      url: string
    }
  },
  condition: {
    urlFilter: string,
    resourceTypes: chrome.declarativeNetRequest.ResourceType[]
  }
}

export interface Site {
  id: string,
  url: string
}

export interface ResToSend {
  success: boolean,
  status?: Status, 
  msg?: string,
  rules?: Site[],
  error?: any
}

export interface MsgToSend {
  action: Action,
  url?: string
}

type Status = "added" | "duplicate" | "deleted" | "getRules";
type Action = "blockUrl" | "deleteAll" | "getRules";
