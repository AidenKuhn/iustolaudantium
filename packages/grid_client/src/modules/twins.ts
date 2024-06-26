import { TFClient } from "../clients/tf-grid/client";
import { GridClientConfig } from "../config";
import { expose } from "../helpers/expose";
import { validateInput } from "../helpers/validator";
import { TwinCreateModel, TwinDeleteModel, TwinGetByAccountIdModel, TwinGetModel } from "./models";
import { checkBalance } from "./utils";

class Twins {
  client: TFClient;
  constructor(config: GridClientConfig) {
    this.client = new TFClient(config.substrateURL, config.mnemonic, config.storeSecret, config.keypairType);
  }

  @expose
  @validateInput
  @checkBalance
  async create(options: TwinCreateModel) {
    return await this.client.twins.create(options.relay);
  }

  @expose
  @validateInput
  @checkBalance
  async update(options: TwinCreateModel) {
    return await this.client.twins.update(options.relay);
  }

  @expose
  @validateInput
  async get(options: TwinGetModel) {
    return await this.client.twins.get(options.id);
  }

  @expose
  @validateInput
  async get_my_twin_id() {
    return await this.client.twins.getMyTwinId();
  }

  @expose
  @validateInput
  async get_twin_id_by_account_id(options: TwinGetByAccountIdModel) {
    return await this.client.twins.getTwinIdByAccountId(options.public_key);
  }

  @expose
  @validateInput
  async list() {
    return await this.client.twins.list();
  }
  @expose
  @validateInput
  @checkBalance
  async delete(options: TwinDeleteModel) {
    return await this.client.twins.delete(options.id);
  }
}

export { Twins as twins };
