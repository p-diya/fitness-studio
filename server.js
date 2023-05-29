// imports and configuration
const express = require("express");
const app = express();
const PORT = process.env.PORT || 8080;

// static resources folder
app.use(express.static("assets"));

// configure express to receive form field data
app.use(express.urlencoded({ extended: true }));

// colors for nodejs console
var colors = require("colors");

// express handlebars
const exphbs = require("express-handlebars");

app.engine(
	".hbs",
	exphbs.engine({
		extname: ".hbs",
		// functionality to output the contents of an object in the template
		helpers: {
			json: (context) => {
				return JSON.stringify(context);
			},
		},
	})
);
// Setting the view engine for the Express application to use Handlebars
app.set("view engine", ".hbs");

// express sessions
const session = require("express-session");
app.use(
	session({
		// random string, used for configuring the session
		secret: "the quick brown fox jumped over the lazy dog 1234567890",
		resave: false,
		saveUninitialized: true,
	})
);

// MongoDB Atlas database connection
const mongoose = require("mongoose");
const uri = `mongodb+srv://admin:<password>@fitness-studio.m7y3c1j.mongodb.net/?retryWrites=true&w=majority`;
mongoose.connect(uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
});
mongoose.connection.on("open", () => {
	console.log(`MongoDB: Database connected successfully`.green);
	console.log(`~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`.grey);
});

// user Schema
const userSchema = new mongoose.Schema({
	firstName: {
		type: String,
		required: true,
	},
	email: {
		type: String,
		required: true,
		unique: true,
	},
	password: {
		type: String,
		required: true,
	},
	isMember: {
		type: Boolean,
		default: false,
	},
	isAdmin: {
		type: Boolean,
		default: false,
	},
	date: {
		type: Date,
		default: Date.now,
	},
});

// class schema
const classSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
	},
	level: {
		type: String,
		required: true,
	},
	instructor: {
		type: String,
		required: true,
	},
	duration: {
		type: Number,
		required: true,
	},
	img: {
		type: String,
		required: true,
	},
});

const userDataSchema = new mongoose.Schema({
	firstName: String,
	email: String,
	class: String,
	level: String,
	instructor: String,
	duration: Number,
	isMember: Boolean,
	amount: Number,
});

const cartSchema = new mongoose.Schema({
	className: String,
	instructor: String,
	cost: Number,
	level: String,
	duration: Number,
});

// models
const User = new mongoose.model("User", userSchema);
const Class = new mongoose.model("Class", classSchema);
const UserData = mongoose.model("UserData", userDataSchema);
const Cart = mongoose.model("Cart", cartSchema);

// Middleware function to check if the user is logged in
const isLoggedIn = (req, res, next) => {
	req.session.form = "login";

	if (req.session.user) {
		next();
	} else {
		res.render("login", {
			title: "Login",
			layout: "index",
			form: "login",
			formIsLogin: true,
		});
	}
};

// ----------------------------------------------------------------------------------------------
// endpoints
// ----------------------------------------------------------------------------------------------
app.get("/", (req, res) => {
	const user = req.session.user;
	res.render("home", {
		title: "Fitness Studio",
		layout: "index",
		user,
	});
});

// GET: Login endpoint
app.get("/login", (req, res) => {
	req.session.form = "login";
	res.render("login", {
		title: "Login",
		layout: "index",
		form: "login",
		formIsLogin: true,
		user: req.session.user,
	});
});

// POST: Login endpoint
app.post("/login", async (req, res) => {
	try {
		const email = req.body.email;
		const password = req.body.password;

		const user = await User.findOne({ email });
		if (email.length === 0) {
			console.log(`ERROR: Invalid Email`.red);
			return res.render("login", {
				title: "Login",
				layout: "index",
				form: "login",
				formIsLogin: true,
				user: req.session.user,
				message: "Please enter your email",
			});
		}
		if (!user) {
			console.log(`ERROR: Invalid Email`.red);
			return res.render("login", {
				title: "Login",
				layout: "index",
				form: "login",
				formIsLogin: true,
				user: req.session.user,
				message: "Invalid Email",
			});
		} else if (user.password !== password) {
			console.log(`ERROR: Incorrect Password`.red);
			return res.render("login", {
				title: "Login",
				layout: "index",
				form: "login",
				formIsLogin: true,
				user: req.session.user,
				message: "Incorrect Password",
			});
		}

		req.session.user = user;

		// Check if the user is an admin
		if (user.isAdmin) {
			return res.redirect("/admin");
		} else {
			return res.redirect("/classes");
		}
	} catch (err) {
		console.log(err);
	}
});

// Logout endpoint
app.get("/logout", isLoggedIn, (req, res) => {
	req.session.destroy();
	res.render("logout", {
		title: "Logout",
		layout: "index",
	});
});

// GET: Signup endpoint
app.get("/signup", (req, res) => {
	req.session.form = "signup";
	res.render("login", {
		title: "Create Account",
		layout: "index",
		form: "signup",
		formIsLogin: false,
		user: req.session.user,
	});
});

// POST: Signup endpoint
app.post("/signup", async (req, res) => {
	try {
		const { firstName, newEmail, newPassword, isMember } = req.body;

		// Validate the form
		if (!firstName || !newEmail || !newPassword) {
			return res.render("login", {
				title: "Create Account",
				layout: "index",
				form: "signup",
				formIsLogin: false,
				message: "Missing required fields",
				user: req.session.user,
			});
		}

		if (isMember !== "yes" && isMember !== "no") {
			return res.render("login", {
				title: "Create Account",
				layout: "index",
				form: "signup",
				formIsLogin: false,
				message: "Please select your membership plan",
				user: req.session.user,
			});
		}

		// Create a new user
		const user = new User({
			firstName,
			email: newEmail,
			password: newPassword,
			isMember: isMember === "yes",
		});

		//  Save the new user to the database
		await user.save();

		// Set the user in the session
		req.session.user = user;

		let signupAmount = 0;

		if (user.isMember) {
			signupAmount = 75;
		}
		//Account Creation to Admin Database
		await UserData.create({
			firstName: user.firstName,
			email: user.email,
			class: "",
			level: "",
			instructor: "",
			duration: "",
			isMember: user.isMember,
			amount: signupAmount,
		});

		// Redirect to the class page
		res.redirect("/classes");
	} catch (error) {
		console.log(error.red);
	}
});

app.get("/classes", async (req, res) => {
	// Check if there is a user session
	user = req.session.user;
	const classData = await Class.find({}).lean();
	res.render("class", {
		user: user,
		title: "Class Schedule",
		layout: "index",
		classData,
	});
});

// GET: Cart endpoint
app.get("/cart", async (req, res) => {
	try {
		const cartData = await Cart.find({}).lean();
		let subTotalCost = 0;
		let tax = 0;
		let totalCost = 0;

		if (req.session.user && req.session.user.isMember === true) {
			res.render("cart", {
				title: "Shopping Cart",
				layout: "index",
				user: req.session.user,
				subTotalCost,
				tax,
				totalCost,
				cartData,
			});
		} else {
			try {
				const result = await Cart.aggregate([
					{
						$group: {
							_id: null,
							subTotalCost: { $sum: "$cost" },
						},
					},
				]);
				subTotalCost = result[0].subTotalCost;
				console.log(subTotalCost);
				tax = 1.13;
				totalCostNF = subTotalCost * tax;
				totalCost = parseFloat(totalCostNF.toFixed(2));
				console.log(totalCost);
			} catch (error) {
				console.log(`No items in cart`);
			}
			res.render("cart", {
				title: "Shopping Cart",
				layout: "index",
				user: req.session.user,
				subTotalCost,
				tax,
				totalCost,
				cartData,
			});
		}
	} catch (error) {
		console.log(error);
	}
});

let result = [];
const getTotal = async () => {
	result = await UserData.aggregate([
		{
			$group: {
				_id: null,
				totalAmount: { $sum: "$amount" },
			},
		},
	]);
};

// GET: Admin endpoint
app.get("/admin", async (req, res) => {
	try {
		const { user } = req.session;

		// Get the user data from UserData model.
		const userData = await UserData.find({}).lean();
		let totalAmount = 0;
		await getTotal();
		totalAmount = result[0].totalAmount;
		console.log(totalAmount);
		// Check if the user is logged in
		if (!user) {
			console.log(`!user`);
			return res.render("admin", {
				title: "Admin Dashboard",
				layout: "index",
				isAdmin: false,
				message: "You must log in to access this page",
				user: req.session.user,
			});
		}

		// Check if the user is an admin
		else if (!user.isAdmin) {
			console.log(`isAdmin`);
			return res.render("admin", {
				title: "Admin Dashboard",
				layout: "index",
				isAdmin: false,
				message: "Only authorized person can access this page",
				user: req.session.user,
			});
		}

		// Render the admin page
		res.render("admin", {
			title: "Admin Dashboard",
			layout: "index",
			isAdmin: true,
			userData,
			totalAmount,
			user: req.session.user,
		});
	} catch (error) {
		console.log(error.red);
	}
});

// POST: Add to cart endpoint
app.post(
	"/cart/add/:className/:instructor/:duration/:level",
	async (req, res) => {
		const user = req.session.user;
		// Check if the user is logged in
		if (!user) {
			res.send(
				'<script>alert("You must be logged in to book class!"); window.location.href = "/login";</script>'
			);
			return;
		}
		const className = req.params.className;
		const instructor = req.params.instructor;
		const duration = req.params.duration;
		const level = req.params.level;
		let cost = 0;
		if (!user.isMember) {
			cost = duration * 0.75;
		}
		console.log(cost);
		await Cart.create({
			className: className,
			instructor: instructor,
			cost: cost,
			level: level,
			duration: duration,
		});
		console.log(`${className} and ${instructor} saved to the database`);
		res.redirect("/classes");
	}
);

// POST: Remove from cart endpoint
app.post("/cart/remove/:className/:instructor/", async (req, res) => {
	const className = req.params.className;
	const instructor = req.params.instructor;
	await Cart.deleteOne({ className: className, instructor: instructor });
	console.log(`${className} and ${instructor} removed from the database`);
	res.redirect("/cart");
});

// POST: Payment endpoint
app.post("/pay", async (req, res) => {
	user = req.session.user;
	const cartData = await Cart.find({});
	console.log(cartData);
	const firstName = user.firstName;
	const email = user.email;
	cartData.forEach(async (cartItem) => {
		await UserData.create({
			firstName: firstName,
			email: email,
			class: cartItem.className,
			level: cartItem.level,
			instructor: cartItem.instructor,
			duration: cartItem.duration,
			isMember: user.isMember,
			amount: cartItem.cost,
		});
	});

	await Cart.deleteMany({}); //Empties the cart after paying

	let randomNum = Math.floor(100000 + Math.random() * 900000);

	res.render("order", { layout: "index", randomNum });

	console.log(`Data added to admin database`);
});

// POST: Sort endpoint
app.post("/sort", async (req, res) => {
	const userData = await UserData.find({}).sort({ email: 1 }).lean();
	await getTotal();
	totalAmount = result[0].totalAmount;
	res.render("admin", {
		title: "Admin Dashboard",
		layout: "index",
		isAdmin: true,
		userData,
		totalAmount,
		user: req.session.user,
	});
});

// start express web server
const onHttpStart = () => {
	console.log(`EXPRESS: Server is listening on ${PORT}`.yellow);
	console.log(`http://localhost:${PORT}`.gray);
};
app.listen(PORT, onHttpStart);
