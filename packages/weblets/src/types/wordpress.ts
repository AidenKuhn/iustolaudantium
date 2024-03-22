import { v4 } from "uuid";

import generatePassword from "../utils/generatePassword";
import VM from "./vm";
export default class Wordpress extends VM {
  public id = v4().split("-")[0];
  public name = `WP${this.id}`;
  public adminEmail = "";
  public adminUsername = "admin";
  public diskSize = 50;
  public adminPassword = generatePassword(length);
  public domain = "";
}
