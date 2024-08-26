import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import axios from "axios";
import { markInvalid, markValid } from "@/api";
import { nav } from "@/views/nav";
import { toggleSubmitBtn, submitBtn } from "@/views/components";
import { loggedInUser } from "../login";
import page from 'page';


export async function POSpage(ctx, next) {

}