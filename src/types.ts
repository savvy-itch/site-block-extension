import { DeclarativeNetRequest } from "webextension-polyfill"

export interface NewRule {
  id: number,
  priority: number,
  action: {
    type: DeclarativeNetRequest.RuleActionTypeEnum,
    redirect?: {
      regexSubstitution: string
    }
  },
  condition: {
    regexFilter: string,
    resourceTypes: DeclarativeNetRequest.ResourceType[]
  }
}

export interface Site {
  id: number,
  url: string,
  strippedUrl: string,
  blockDomain: boolean,
  isActive: boolean
}

export interface RuleInStorage {
  id: number,
  unblockDate: number,
  urlToBlock: string
}

export interface ResToSend {
  success: boolean,
  status?: Status, 
  msg?: string,
  rules?: Site[],
  url?: string,
  error?: any
}

type Status = "added" | 
"currUrl" |"duplicate" | "deleted" | "deletedRule" | "forbidden" | "getRules" | "updated";

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

export interface GetCurrentUrl {
  action: "getCurrentUrl",
}


export type Action = AddAction | DeleteAction | DeleteAllAction | GetAllAction |
GetCurrentUrl | UpdateAction
