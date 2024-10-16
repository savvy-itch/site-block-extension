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
  id: number,
  url: string,
  blockDomain: boolean
}

export interface ResToSend {
  success: boolean,
  status?: Status, 
  msg?: string,
  rules?: Site[],
  error?: any
}

export interface CustomReq {
  action: Action,
  url?: string,
  blockDomain?: boolean,
  deleteRuleId?: number
}

type Status = "added" | "duplicate" | "deleted" | "deletedRule" | "getRules";
type Action = "blockUrl" | "deleteAll" | "deleteRule" | "getRules";
