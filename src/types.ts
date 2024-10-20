export interface NewRule {
  id: number,
  priority: number,
  action: {
    type: chrome.declarativeNetRequest.RuleActionType,
    redirect?: {
      // url: string
      regexSubstitution: string
    }
  },
  condition: {
    // urlFilter: string,
    regexFilter: string,
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

type Status = "added" | "duplicate" | "deleted" | "deletedRule" | "getRules" | "updated";

export interface AddAction {
  action: "blockUrl",
  url: string,
  blockDomain: boolean
}

export interface DeleteAction {
  action: "deleteRule",
  deleteRuleId: number
}

export interface DeleteAllAction {
  action: "deleteAll"
}

export interface GetAllAction {
  action: "getRules",
}

export interface UpdateAction {
  action: "updateRules",
  updatedRules: NewRule[]
}


export type Action = AddAction | DeleteAction | DeleteAllAction | GetAllAction | UpdateAction
